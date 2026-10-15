// 원격 MCP 서버(Streamable HTTP)의 도구를 일반 도구로 옮긴다. Worker가 직접 서버와 이야기하므로 토큰이
// Claude API 요청에 실리지 않는다. Claude API MCP 커넥터는 Cloudflare MCP와 연결에 실패했다(2026-10-15).
import type { Tool } from './claude.ts';

export type McpServer = { name: string; url: string; token: string };

const MAX_CHARS = 6_000;

/** JSON 응답 또는 SSE(`data:` 줄) 응답에서 JSON-RPC 결과를 꺼낸다. */
export function parseRpc(body: string): { result?: unknown; error?: { message?: string } } {
  const t = body.trim();
  if (t.startsWith('{')) return JSON.parse(t) as { result?: unknown };
  const data = t
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  if (!data.length) throw new Error('MCP 응답이 비었어요');
  return JSON.parse(data.at(-1)!) as { result?: unknown };
}

export async function mcpTools(server: McpServer, fetcher: typeof fetch = fetch): Promise<Tool[]> {
  let session: string | null = null;
  let id = 0;
  const send = async (method: string, params?: unknown, notify = false) => {
    const r = await fetcher(server.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${server.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        ...(notify ? {} : { id: ++id }),
        ...(params ? { params } : {}),
      }),
    });
    session = r.headers.get('mcp-session-id') ?? session;
    const text = await r.text();
    if (!r.ok) throw new Error(`MCP ${server.name} ${r.status}: ${text.slice(0, 200)}`);
    if (notify) return undefined;
    const rpc = parseRpc(text);
    if (rpc.error) throw new Error(`MCP ${server.name}: ${rpc.error.message ?? 'error'}`);
    return rpc.result;
  };
  await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'offside-agents', version: '1' },
  });
  await send('notifications/initialized', undefined, true);
  const list = (await send('tools/list')) as {
    tools?: { name: string; description?: string; inputSchema?: Record<string, unknown> }[];
  };
  return (list.tools ?? []).map((t) => ({
    name: `${server.name}_${t.name}`,
    description: (t.description ?? '').slice(0, 4000),
    input_schema: t.inputSchema ?? { type: 'object' },
    run: async (input) => {
      const res = (await send('tools/call', { name: t.name, arguments: input })) as {
        content?: { type: string; text?: string }[];
        isError?: boolean;
      };
      const text = (res.content ?? []).map((c) => c.text ?? `[${c.type}]`).join('\n');
      if (res.isError) throw new Error(text.slice(0, 500));
      return text.length > MAX_CHARS
        ? `${text.slice(0, MAX_CHARS)}\n…(잘림, ${text.length}자)`
        : text;
    },
  }));
}
