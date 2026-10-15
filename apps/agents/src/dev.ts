// ADR-015 3단계 @dev(손흥민). 운영자 지시 → agent-dev.yml(Actions가 고치고 PR) → CI 결과 → #agent-approvals 승인 카드 → 운영자 버튼으로 squash 머지.
// 코드를 고치는 쪽(Actions의 Claude)은 push 권한이 없고, 머지는 승인 버튼을 누른 사람이 운영자일 때만 Worker가 한다.
import type { Tool } from './claude.ts';
import { botToken, dailyBudget, ROLE_NAMES, type Env } from './env.ts';
import { ghClient, installationToken, type Gh } from './github.ts';
import { ledger, type DevJob } from './ledger.ts';
import { slackClient, threadReply } from './slack.ts';
import type { Task } from './thread.ts';

const WORKFLOW = 'agent-dev.yml';
/** 머지해도 되는 검사 결론. */
const PASSING = new Set(['success', 'skipped', 'neutral']);

export const appGh = async (env: Env, fetcher: typeof fetch = fetch): Promise<Gh> => {
  if (!env.GITHUB_APP_PRIVATE_KEY) throw new Error('GitHub 앱 키가 없어요(GITHUB_APP_PRIVATE_KEY)');
  const token = await installationToken(
    {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      installationId: env.GITHUB_APP_INSTALLATION_ID,
    },
    fetcher,
  );
  return ghClient(env.GITHUB_REPO, token, fetcher);
};

const devSlack = (env: Env) => slackClient(botToken(env, 'dev'), fetch, ROLE_NAMES.dev);

export const threadLink = (channel: string, ts: string) =>
  `https://offside-lab.slack.com/archives/${channel}/p${ts.replace('.', '')}`;

/**
 * @dev 도구. `start_work`는 운영자가 직접 맡긴 일(멘션 · 답글)에만 준다. 다른 에이전트가 넘긴 일(유저 글이 섞일 수 있다)로는
 * 코드를 고치기 시작하지 않는다.
 */
export function devTools(env: Env, task: Task, gh: () => Promise<Gh> = () => appGh(env)): Tool[] {
  const tools: Tool[] = [
    {
      name: 'pr_status',
      description: 'PR 하나의 상태(열림 · 머지 · 검사 결과)를 본다.',
      input_schema: {
        type: 'object',
        properties: { number: { type: 'integer' } },
        required: ['number'],
      },
      run: async (input) => {
        const g = await gh();
        const { data: pr } = await g<PullRequest>(`/pulls/${Number(input.number)}`);
        if (!pr.head) return 'PR을 찾지 못했어요';
        const checks = await checkSummary(g, pr.head.sha);
        return JSON.stringify({
          number: pr.number,
          title: pr.title,
          state: pr.merged ? 'merged' : pr.state,
          branch: pr.head.ref,
          url: pr.html_url,
          checks,
        });
      },
    },
  ];
  if (task.kind !== 'mention' && task.kind !== 'reply') return tools;
  let started = false;
  tools.push({
    name: 'start_work',
    description:
      'GitHub Actions에서 코드 수정 작업을 시작한다(Claude Code가 고치고 커밋 → 브랜치 · PR). 한 번 부르면 이 답에서는 다시 부르지 않는다. request에는 고칠 것 · 범위 · 확인 방법 · 작업 ID(있으면)를 구체적으로 쓴다.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '작업 제목 한 줄' },
        request: { type: 'string', description: '작업 지시 전체' },
      },
      required: ['title', 'request'],
    },
    run: async (input) => {
      if (started) return '이미 이 답에서 작업을 시작했어요';
      const today = await ledger(env).day('dev');
      const left = dailyBudget(env, 'dev') - today.costUsd;
      if (left < Number(env.DEV_RUN_BUDGET_USD))
        return `오늘 남은 금액($${left.toFixed(2)})이 작업 한 번 한도($${env.DEV_RUN_BUDGET_USD})보다 적어서 시작하지 않았어요`;
      const g = await gh();
      const r = await g(`/actions/workflows/${WORKFLOW}/dispatches`, {
        method: 'POST',
        body: {
          ref: 'main',
          inputs: {
            title: String(input.title).slice(0, 120),
            request: String(input.request).slice(0, 20_000),
            thread: `${task.channel}:${task.threadTs}`,
          },
        },
      });
      if (r.status !== 204) return `작업을 띄우지 못했어요 (GitHub ${r.status})`;
      started = true;
      return `시작했어요. 진행은 https://github.com/${env.GITHUB_REPO}/actions/workflows/${WORKFLOW} 에서 보이고, 끝나면 이 스레드에 결과가 올라와요(보통 10~30분).`;
    },
  });
  return tools;
}

type PullRequest = {
  number: number;
  title: string;
  state: string;
  merged?: boolean;
  html_url: string;
  head: { sha: string; ref: string };
  base: { ref: string };
  mergeable?: boolean | null;
};

/** 커밋의 검사 결과 요약. 다 끝났고 전부 통과(건너뜀 포함)면 passing. */
export async function checkSummary(g: Gh, sha: string) {
  const { data } = await g<{
    check_runs: { name: string; status: string; conclusion: string | null }[];
  }>(`/commits/${sha}/check-runs?per_page=100`);
  const runs = data.check_runs ?? [];
  const failed = runs.filter((c) => c.status === 'completed' && !PASSING.has(c.conclusion ?? ''));
  const pending = runs.filter((c) => c.status !== 'completed');
  return {
    total: runs.length,
    failed: failed.map((c) => c.name),
    pending: pending.map((c) => c.name),
    passing: runs.length > 0 && !failed.length && !pending.length,
  };
}

export type DevResult = {
  thread: string;
  ok: boolean;
  run: string;
  cost?: number;
  turns?: number;
  text?: string;
  reason?: string;
  pr?: number;
  branch?: string;
  title?: string;
};

/** agent-dev.yml publish 잡이 보낸 결과를 스레드에 올린다. 비용은 @dev 하루 사용액에 더한다. */
export async function devResult(env: Env, r: DevResult) {
  const [channel, threadTs] = r.thread.split(':');
  if (!channel || !threadTs) throw new Error('bad thread');
  const day = await ledger(env).add('dev', Number(r.cost ?? 0));
  const footer = `Actions · ${r.turns ?? 0}턴 · $${Number(r.cost ?? 0).toFixed(3)} · 오늘 dev $${day.costUsd.toFixed(2)} · <${r.run}|실행 기록>`;
  const said = (r.text ?? '').trim();
  let text: string;
  if (r.ok && r.pr && r.branch) {
    await ledger(env).setDevJob(r.branch, { channel, threadTs, pr: r.pr, title: r.title ?? '' });
    text = `${said || '고쳐서 PR을 올렸어요.'}\n\n**PR #${r.pr}** https://github.com/${env.GITHUB_REPO}/pull/${r.pr}\nCI가 끝나면 결과를 여기 알려 드릴게요. 통과하면 #agent-approvals에 머지 승인 요청을 올려요.`;
  } else {
    text = `작업을 끝까지 넣지 못했어요. ${r.reason ?? ''}${said ? `\n\n${said}` : ''}`;
  }
  await devSlack(env)('chat.postMessage', threadReply(channel, threadTs, text, footer));
}

export type DevCi = { branch: string; sha: string; conclusion: string; url: string };

/** PR CI가 끝났을 때. 통과면 승인 카드, 실패면 스레드에 알린다. 취소(새 push로 밀림)는 넘긴다. */
export async function devCi(env: Env, c: DevCi, gh: () => Promise<Gh> = () => appGh(env)) {
  const job = await ledger(env).devJob(c.branch);
  if (!job) return 'unknown branch';
  if (c.conclusion === 'cancelled' || c.conclusion === 'skipped') return 'ignored';
  const slack = devSlack(env);
  if (c.conclusion !== 'success') {
    await slack(
      'chat.postMessage',
      threadReply(
        job.channel,
        job.threadTs,
        `PR #${job.pr} CI가 실패했어요(${c.conclusion}). <${c.url}|CI 기록>을 보고 다시 지시해 주세요.`,
      ),
    );
    return 'failed';
  }
  const g = await gh();
  const { data: pr } = await g<PullRequest>(`/pulls/${job.pr}`);
  if (pr.state !== 'open' || pr.head?.sha !== c.sha) return 'stale';
  await slack('chat.postMessage', approvalCard(env, job, c));
  await slack(
    'chat.postMessage',
    threadReply(
      job.channel,
      job.threadTs,
      `PR #${job.pr} CI 통과했어요. #agent-approvals에 머지 승인 요청을 올렸어요.`,
    ),
  );
  return 'card';
}

export function approvalCard(env: Env, job: DevJob, c: DevCi) {
  const prUrl = `https://github.com/${env.GITHUB_REPO}/pull/${job.pr}`;
  const value = JSON.stringify({ pr: job.pr, sha: c.sha, branch: c.branch });
  const text = [
    `*머지 승인 요청* · <${prUrl}|PR #${job.pr}> ${job.title}`,
    `• 무엇을: 위 PR을 main에 squash 머지`,
    `• 왜: 운영자 지시(<${threadLink(job.channel, job.threadTs)}|스레드>)`,
    `• 검사: <${c.url}|CI 통과> · 커밋 \`${c.sha.slice(0, 7)}\``,
    `• 되돌리기: main에서 이 PR을 revert. 운영 배포는 따로예요(머지만 해요).`,
  ].join('\n');
  return {
    channel: env.APPROVAL_CHANNEL,
    text: `머지 승인 요청 PR #${job.pr}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '승인하고 머지' },
            style: 'primary',
            action_id: 'dev_merge',
            value,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '거절' },
            style: 'danger',
            action_id: 'dev_reject',
            value,
          },
        ],
      },
    ],
  };
}

type Interaction = {
  type: string;
  user: { id: string };
  channel?: { id: string };
  message?: { ts: string; blocks?: unknown[] };
  actions?: { action_id: string; value: string }[];
};

/** 승인 버튼. 운영자가 아니면 아무것도 하지 않는다. 머지 직전에 PR · 커밋 · 검사 · main 최신 여부를 다시 확인한다. */
export async function devInteraction(
  env: Env,
  p: Interaction,
  gh: () => Promise<Gh> = () => appGh(env),
) {
  const act = p.actions?.[0];
  if (p.type !== 'block_actions' || !act || !['dev_merge', 'dev_reject'].includes(act.action_id))
    return 'ignored';
  const slack = devSlack(env);
  const channel = p.channel?.id ?? env.APPROVAL_CHANNEL;
  const cardTs = p.message?.ts;
  const v = JSON.parse(act.value) as { pr: number; sha: string; branch: string };
  const finish = async (line: string) => {
    if (cardTs)
      await slack('chat.update', {
        channel,
        ts: cardTs,
        text: line,
        blocks: [
          ...((p.message?.blocks ?? []).slice(0, 1) as unknown[]),
          { type: 'context', elements: [{ type: 'mrkdwn', text: line }] },
        ],
      });
    const job = await ledger(env).devJob(v.branch);
    if (job) await slack('chat.postMessage', threadReply(job.channel, job.threadTs, line));
  };
  if (p.user.id !== env.OPERATOR_USER_ID) {
    await slack('chat.postEphemeral', {
      channel,
      user: p.user.id,
      text: '승인은 운영자만 할 수 있어요.',
    });
    return 'forbidden';
  }
  const record = (action: 'merge' | 'reject', result: string) =>
    ledger(env).recordApproval({
      pr: v.pr,
      sha: v.sha,
      action,
      user: p.user.id,
      at: Date.now(),
      result,
    });
  if (act.action_id === 'dev_reject') {
    await record('reject', 'rejected');
    await finish(`<@${p.user.id}>님이 PR #${v.pr} 머지를 거절했어요. PR은 열어 둬요.`);
    return 'rejected';
  }
  const g = await gh();
  const { data: pr } = await g<PullRequest>(`/pulls/${v.pr}`);
  const why = await mergeBlocker(g, pr, v.sha);
  if (why) {
    await record('merge', `blocked: ${why}`);
    await finish(`PR #${v.pr}은 머지하지 않았어요. ${why}`);
    return 'blocked';
  }
  const m = await g<{ sha?: string; message?: string }>(`/pulls/${v.pr}/merge`, {
    method: 'PUT',
    body: { merge_method: 'squash', sha: v.sha, commit_title: `${pr.title} (#${v.pr})` },
  });
  if (m.status !== 200) {
    await record('merge', `failed ${m.status}`);
    await finish(`PR #${v.pr} 머지가 실패했어요 (GitHub ${m.status} ${m.data.message ?? ''}).`);
    return 'failed';
  }
  await record('merge', `merged ${m.data.sha}`);
  await finish(
    `<@${p.user.id}>님 승인으로 PR #${v.pr}을 머지했어요(\`${(m.data.sha ?? '').slice(0, 7)}\`). 운영 배포는 따로 해 주세요.`,
  );
  return 'merged';
}

/** 머지하면 안 되는 이유. 없으면 null. main이 앞서 있으면 브랜치를 최신 main으로 맞추고(CI가 다시 돈다) 새 카드를 기다린다. */
export async function mergeBlocker(g: Gh, pr: PullRequest, sha: string): Promise<string | null> {
  if (!pr.head) return 'PR을 찾지 못했어요.';
  if (pr.merged || pr.state !== 'open') return '이미 닫혔거나 머지된 PR이에요.';
  if (pr.base.ref !== 'main') return 'main으로 가는 PR이 아니에요.';
  if (!pr.head.ref.startsWith('agent-dev/')) return '@dev가 연 브랜치가 아니에요.';
  if (pr.head.sha !== sha)
    return '승인 카드 뒤에 커밋이 바뀌었어요. 새 CI 결과 카드를 기다려 주세요.';
  const checks = await checkSummary(g, sha);
  if (!checks.passing)
    return `검사가 다 통과하지 않았어요(실패 ${checks.failed.length} · 진행 중 ${checks.pending.length}).`;
  const { data: cmp } = await g<{ behind_by?: number }>(`/compare/main...${sha}`);
  if ((cmp.behind_by ?? 0) > 0) {
    await g(`/pulls/${pr.number}/update-branch`, {
      method: 'PUT',
      body: { expected_head_sha: sha },
    });
    return `main이 ${cmp.behind_by}커밋 앞서 있어서 브랜치를 최신 main으로 맞췄어요. CI가 다시 돌고 통과하면 새 카드가 와요.`;
  }
  return null;
}
