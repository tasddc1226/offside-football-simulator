// Claude Messages API 도구 루프. 모델은 Opus 5.5로 고정하고(ADR-015 결정 2), 응답 모델이 다르면 실패로 끝낸다.
export const MODEL = 'claude-opus-5-5';
const API = 'https://api.anthropic.com/v1/messages';

/** 100만 토큰당 달러(2026-10 Opus 5.5 가격표). 입력 · 5분 캐시 쓰기 · 캐시 읽기 · 출력. */
export const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 } as const;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export const costOf = (u: Usage) =>
  (u.input_tokens * PRICE.input +
    (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
    (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    u.output_tokens * PRICE.output) /
  1e6;

type TextBlock = { type: 'text'; text: string };
type ToolUse = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type ToolResult = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
type Block = TextBlock | ToolUse | ToolResult | { type: string; [k: string]: unknown };
export type Message = { role: 'user' | 'assistant'; content: string | Block[] };

export type Tool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  run: (input: Record<string, unknown>) => Promise<string>;
};

/** 금액 한도의 이 비율을 넘으면 다음 턴을 마지막으로 한다. */
const FINAL_AT = 0.85;
const FINAL_NOTE =
  '조회 한도에 닿았어요. 도구를 더 쓰지 말고 지금까지 확인한 것만으로 답을 정리해 주세요. 확인하지 못한 것은 그렇다고 적어 주세요.';

export class ClaudeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type RunResult = {
  text: string;
  costUsd: number;
  turns: number;
  stopped?: 'budget' | 'turns';
};

export async function runAgent(opts: {
  apiKey: string;
  system: string;
  tools: Tool[];
  messages: Message[];
  maxTurns: number;
  budgetUsd: number;
  fetcher?: typeof fetch;
}): Promise<RunResult> {
  const fetcher = opts.fetcher ?? fetch;
  const messages = [...opts.messages];
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  // 역할 설명 · 도구 정의는 매번 같으니 캐시한다(ADR-015 비용 통제).
  const tools = opts.tools.map(({ run: _run, ...t }, i, all) =>
    i === all.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t,
  );
  let costUsd = 0;
  let stopped: RunResult['stopped'];
  for (let turn = 1; ; turn++) {
    // 마지막 턴(턴 · 금액 한도)은 도구 없이 지금까지 확인한 것으로 답을 쓰게 한다(빈손으로 끝나지 않게).
    if (!stopped && (turn >= opts.maxTurns || costUsd >= opts.budgetUsd * FINAL_AT)) {
      stopped = turn >= opts.maxTurns ? 'turns' : 'budget';
      const last = messages.at(-1);
      const note: TextBlock = { type: 'text', text: FINAL_NOTE };
      if (last?.role === 'user' && Array.isArray(last.content))
        last.content = [...last.content, note];
      else messages.push({ role: 'user', content: [note] });
    }
    const r = await fetcher(API, {
      method: 'POST',
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
        tools,
        ...(stopped ? { tool_choice: { type: 'none' } } : {}),
        messages,
      }),
    });
    const data = (await r.json().catch(() => ({}))) as {
      model?: string;
      content?: Block[];
      stop_reason?: string;
      usage?: Usage;
      error?: { type?: string; message?: string };
    };
    if (!r.ok)
      throw new ClaudeError(
        r.status,
        [data.error?.type ?? `http_${r.status}`, data.error?.message?.slice(0, 300)]
          .filter(Boolean)
          .join(': '),
      );
    if (!data.model?.startsWith(MODEL)) throw new ClaudeError(0, `unexpected model: ${data.model}`);
    if (data.usage) costUsd += costOf(data.usage);
    const content = data.content ?? [];
    messages.push({ role: 'assistant', content });
    const text = content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (data.stop_reason !== 'tool_use' || stopped)
      return { text, costUsd, turns: turn, ...(stopped ? { stopped } : {}) };
    const results: ToolResult[] = [];
    for (const b of content) {
      if (b.type !== 'tool_use') continue;
      const use = b as ToolUse;
      const tool = byName.get(use.name);
      try {
        if (!tool) throw new Error(`unknown tool ${use.name}`);
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: await tool.run(use.input),
        });
      } catch (e) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: String(e instanceof Error ? e.message : e).slice(0, 500),
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: results });
  }
}
