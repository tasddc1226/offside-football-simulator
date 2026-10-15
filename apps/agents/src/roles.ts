// 역할마다 시스템 프롬프트(roles/<역할>.md) · 도구 · 턴 상한. 3단계까지 @ops · @plan · @dev가 있다.
import { MODELS, type Model, type Tool } from './claude.ts';
import type { McpServer } from './mcp.ts';
import type { Env, Role } from './env.ts';
import type { Task } from './thread.ts';
import dev from '../roles/dev.md';
import ops from '../roles/ops.md';
import plan from '../roles/plan.md';
import { devTools } from './dev.ts';
import { repoReadToken } from './github.ts';
import { supportTools } from './support.ts';
import { opsTools } from './tools/ops.ts';
import { digestTools } from './tools/digest.ts';
import { scheduleTools } from './tools/schedules.ts';

export type RoleSpec = {
  system: string;
  model: Model;
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

/**
 * 일에 맞는 모델(T-11-289 비용 절감). 유저 반응 분류 · 경보 첫 정리는 Haiku, 아침 보고는 Sonnet, 운영자 지시 ·
 * 넘겨받은 일(원인 분석 · 기획 · 코드)은 Opus. 경보 스레드에서 운영자가 다시 부르면 Opus로 깊게 본다.
 */
export const modelFor = (kind: Task['kind']): Model =>
  kind === 'triage' || kind === 'alert'
    ? MODELS.haiku
    : kind === 'report' || kind === 'support'
      ? MODELS.sonnet
      : MODELS.opus;

export function roleSpec(env: Env, role: Role, task: Task): RoleSpec {
  const model = modelFor(task.kind);
  const gh = repoReadToken(env);
  const tools = opsTools({
    accountId: env.CF_ACCOUNT_ID,
    databaseId: env.D1_DATABASE_ID,
    d1Token: env.CF_D1_READ_TOKEN,
    repo: env.GITHUB_REPO,
    githubToken: gh,
  });
  if (role === 'plan')
    return {
      system: plan,
      model,
      // 기획은 규칙 · 보드 확인과 비슷한 댓글 찾기만 한다. Actions · Cloudflare 로그는 @ops에게 넘긴다.
      // 고객 문의 정리 · 운영자 지시에는 문의 메일 도구(읽기 · 초안 + 승인 카드)를 더한다.
      tools: [
        ...tools.filter((t) => t.name === 'repo_file' || t.name === 'd1_query'),
        ...supportTools(env, task),
      ],
      maxTurns: task.kind === 'support' ? 14 : 8,
      mcpServers: [],
      prompt: (t) =>
        t.kind === 'triage' || t.kind === 'support'
          ? t.text
          : t.kind === 'handoff'
            ? handoffPrompt(t)
            : `지금 KST ${kstNow()}. 운영자 지시:\n${t.text}`,
    };
  if (role === 'dev')
    return {
      system: dev,
      model,
      // 개발은 저장소 · PR을 읽고, 운영자가 맡긴 일이면 Actions 작업을 띄운다(start_work). 고치는 건 Actions의 Claude Code가 한다.
      tools: [...tools.filter((t) => t.name === 'repo_file'), ...devTools(env, task)],
      maxTurns: 8,
      mcpServers: [],
      prompt: (t) =>
        t.kind === 'handoff'
          ? `${handoffPrompt(t)}

(넘겨받은 일이라 바로 고치지 않아요. 할 일을 정리해 운영자 확인을 받아요.)`
          : `지금 KST ${kstNow()}. 운영자 지시:\n${t.text}`,
    };
  if (role !== 'ops') throw new Error(`role ${role} is not open yet`);
  return {
    system: ops,
    model,
    tools: [
      ...tools,
      ...digestTools({
        repo: env.GITHUB_REPO,
        githubToken: gh,
        accountId: env.CF_ACCOUNT_ID,
        cfToken: env.CF_MCP_TOKEN,
        workers: ['offside-api', 'offside-agents'],
        d1: (sql) => tools.find((t) => t.name === 'd1_query')!.run({ sql }),
      }),
      ...scheduleTools({
        repo: env.GITHUB_REPO,
        githubToken: gh,
        accountId: env.CF_ACCOUNT_ID,
        cfToken: env.CF_MCP_TOKEN,
        workers: ['offside-api', 'offside-agents'],
      }),
    ],
    // 경보 첫 정리 · 아침 보고는 짧게 끝낸다(report_digest가 자료를 한 번에 모은다).
    maxTurns: task.kind === 'alert' || task.kind === 'report' ? 6 : 15,
    // Cloudflare API MCP(읽기 권한만 있는 토큰): Workers 로그 · 분석 · 설정 조회.
    mcpServers: env.CF_MCP_TOKEN
      ? [{ name: 'cloudflare', url: 'https://mcp.cloudflare.com/mcp', token: env.CF_MCP_TOKEN }]
      : [],
    prompt: (t) =>
      t.kind === 'handoff'
        ? handoffPrompt(t)
        : t.kind === 'report'
          ? `지금 KST ${kstNow()}. 아침 주기 작업 보고를 써 주세요(지난 24시간 결과와 앞으로 24시간 예정). 먼저 \`report_digest\`를 한 번 부르고, 그 결과로 모자란 것만 더 조회해요.`
          : t.kind === 'alert'
            ? `지금 KST ${kstNow()}. #offside-alerts에 경보가 올라왔어요. 첫 정리예요: 조회는 4번 안쪽으로, 확인한 것까지만 정리해 주세요. 원인이 분명하지 않으면 "더 보려면 이 스레드에서 불러 주세요"라고 끝내요.\n\n<alert>\n${t.text}\n</alert>`
            : `지금 KST ${kstNow()}. 운영자 지시:\n${t.text}`,
  };
}
