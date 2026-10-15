// 역할마다 시스템 프롬프트(roles/<역할>.md) · 도구 · 턴 상한. 2단계까지 @ops · @plan이 있다.
import type { Tool } from './claude.ts';
import type { McpServer } from './mcp.ts';
import type { Env, Role } from './env.ts';
import type { Task } from './thread.ts';
import ops from '../roles/ops.md';
import plan from '../roles/plan.md';
import { opsTools } from './tools/ops.ts';

export type RoleSpec = {
  system: string;
  tools: Tool[];
  maxTurns: number;
  mcpServers: McpServer[];
  prompt: (t: Task) => string;
};

const kstNow = () =>
  new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);

/** 넘겨받은 일: 넘긴 역할의 요청과 그 답 전체(자료). */
const handoffPrompt = (t: Task) =>
  `지금 KST ${kstNow()}. @${t.from}가 같은 스레드에서 일을 넘겼어요.\n\n요청: ${t.text}\n\n<context>\n${t.context ?? ''}\n</context>`;

export function roleSpec(env: Env, role: Role): RoleSpec {
  const tools = opsTools({
    accountId: env.CF_ACCOUNT_ID,
    databaseId: env.D1_DATABASE_ID,
    d1Token: env.CF_D1_READ_TOKEN,
    repo: env.GITHUB_REPO,
    githubToken: env.GITHUB_TOKEN,
  });
  if (role === 'plan')
    return {
      system: plan,
      // 기획은 규칙 · 보드 확인과 비슷한 댓글 찾기만 한다. Actions · Cloudflare 로그는 @ops에게 넘긴다.
      tools: tools.filter((t) => t.name === 'repo_file' || t.name === 'd1_query'),
      maxTurns: 8,
      mcpServers: [],
      prompt: (t) =>
        t.kind === 'triage'
          ? t.text
          : t.kind === 'handoff'
            ? handoffPrompt(t)
            : `지금 KST ${kstNow()}. 운영자 지시:\n${t.text}`,
    };
  if (role !== 'ops') throw new Error(`role ${role} is not open yet`);
  return {
    system: ops,
    tools,
    maxTurns: 15,
    // Cloudflare API MCP(읽기 권한만 있는 토큰): Workers 로그 · 분석 · 설정 조회.
    mcpServers: env.CF_MCP_TOKEN
      ? [{ name: 'cloudflare', url: 'https://mcp.cloudflare.com/mcp', token: env.CF_MCP_TOKEN }]
      : [],
    prompt: (t) =>
      t.kind === 'handoff'
        ? handoffPrompt(t)
        : t.kind === 'alert'
          ? `지금 KST ${kstNow()}. #offside-alerts에 경보가 올라왔어요. 원인을 찾아 정리해 주세요.\n\n<alert>\n${t.text}\n</alert>`
          : `지금 KST ${kstNow()}. 운영자 지시:\n${t.text}`,
  };
}
