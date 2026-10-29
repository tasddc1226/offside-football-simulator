// ADR-015 3단계 @dev(손흥민). 운영자 지시 → agent-dev.yml(Actions가 고치고 PR) → CI 결과 → #agent-approvals 승인 카드 → 운영자 버튼으로 squash 머지.
// 코드를 고치는 쪽(Actions의 Claude)은 push 권한이 없고, 머지는 승인 버튼을 누른 사람이 운영자일 때만 Worker가 한다.
import type { Tool } from './claude.ts';
import { dailyBudget, type Env } from './env.ts';
import { ghClient, installationToken, type Gh } from './github.ts';
import { ledger, type DevJob } from './ledger.ts';
import { cardOf } from './card.ts';
import { DEPLOY_ACTIONS, deployInteraction, postDeployCard } from './deploy.ts';
import { above, RISK_LABEL, riskOf } from './risk.ts';
import { reviewPr } from './review.ts';
import { chatClient, threadLink } from './chat.ts';
import { threadReply } from './slack.ts';
import { supportFollowup } from './supportCase.ts';
import type { Task } from './thread.ts';

const WORKFLOW = 'agent-dev.yml';
/** CI가 실패한 PR을 실패 로그를 붙여 다시 고치게 하는 횟수. 넘으면 운영자에게 넘긴다. */
export const MAX_FIXES = 1;
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

const devSlack = (env: Env) => chatClient(env, 'dev');

export { threadLink };

/** `channel:ts` → 그 스레드의 작업 카드. */
const cardOfThread = (env: Env, thread: string) => {
  const [channel, ts] = thread.split(':');
  return cardOf(env, channel!, ts!);
};

/**
 * agent-dev.yml을 띄운다(운영자의 start_work · 주장의 work_order · 시작 카드 승인이 같이 쓴다). @dev 하루 한도가 작업 한 번
 * 한도보다 적게 남았으면 띄우지 않는다. 띄웠으면 null, 아니면 이유.
 */
export async function dispatchWork(
  env: Env,
  g: Gh,
  w: { title: string; request: string; thread: string; branch?: string; ciRun?: string },
): Promise<string | null> {
  const today = await ledger(env).day('dev');
  const left = dailyBudget(env, 'dev') - today.costUsd;
  if (left < Number(env.DEV_RUN_BUDGET_USD))
    return `오늘 남은 금액($${left.toFixed(2)})이 작업 한 번 한도($${env.DEV_RUN_BUDGET_USD})보다 적어서 시작하지 않았어요`;
  const r = await g(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    body: {
      ref: 'main',
      inputs: {
        title: w.title.slice(0, 120),
        request: w.request.slice(0, 20_000),
        thread: w.thread,
        ...(w.branch && w.ciRun ? { branch: w.branch, ci_run: w.ciRun } : {}),
      },
    },
  });
  return r.status === 204 ? null : `작업을 띄우지 못했어요 (GitHub ${r.status})`;
}

/**
 * 운영자 멈춤(stop.ts): 이 스레드가 띄운 agent-dev 실행 중 끝나지 않은 것을 취소한다. 실행 이름 끝의 `[채널:ts]`로
 * 스레드를 가린다(agent-dev.yml run-name). 취소한 실행 번호들.
 */
export async function cancelDevRuns(g: Gh, thread: string): Promise<number[]> {
  const { data } = await g<{
    workflow_runs?: { id: number; status: string; display_title?: string }[];
  }>(`/actions/workflows/${WORKFLOW}/runs?per_page=30`);
  const mine = (data.workflow_runs ?? []).filter(
    (r) => r.status !== 'completed' && (r.display_title ?? '').endsWith(`[${thread}]`),
  );
  const cancelled: number[] = [];
  for (const r of mine) {
    const c = await g(`/actions/runs/${r.id}/cancel`, { method: 'POST' });
    if (c.status === 202) cancelled.push(r.id);
  }
  return cancelled;
}

export const workRunsUrl = (env: Env) =>
  `https://github.com/${env.GITHUB_REPO}/actions/workflows/${WORKFLOW}`;

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
  // T-11-312 운영 배포는 승인 카드로만. 운영자가 직접 맡긴 일에서만 카드를 올린다(누르는 건 운영자).
  let carded = false;
  tools.push({
    name: 'deploy_request',
    description:
      '지금 main 최신 커밋의 운영 배포 승인 카드를 #agent-approvals에 올린다. 지난 운영 배포 뒤 바뀐 커밋 · 마이그레이션을 카드에 적는다. 배포는 운영자가 카드 버튼을 눌러야 시작된다. 한 답에 한 번만.',
    input_schema: { type: 'object', properties: {} },
    run: async () => {
      if (carded) return '이미 이 답에서 카드를 올렸어요';
      const g = await gh();
      const { data: head } = await g<{ sha?: string }>('/commits/main');
      if (!head.sha) return 'main 커밋을 읽지 못했어요';
      const r = await postDeployCard(env, g, head.sha, {
        channel: task.channel,
        threadTs: task.threadTs,
      });
      if (!r.posted)
        return `지난 운영 배포(${r.plan.since}) 뒤 main에 바뀐 커밋이 없어요. 카드를 올리지 않았어요`;
      carded = true;
      return JSON.stringify({
        posted: true,
        sha: head.sha.slice(0, 7),
        since: r.plan.since,
        commits: r.plan.commits.length,
        migrations: r.plan.migrations,
      });
    },
  });
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
      const thread = `${task.channel}:${task.threadTs}`;
      const title = String(input.title);
      const request = String(input.request);
      const why = await dispatchWork(env, await gh(), { title, request, thread });
      if (why) return why;
      started = true;
      // T-11-400 문의 작업 스레드에서 운영자가 직접 맡겨도 그 문의 메일과의 연결(마무리 답장)은 이어 간다.
      const mail = (await ledger(env).orderOf(thread))?.mail;
      // T-11-325 운영자가 직접 맡긴 일: 위험도 경고 없이 승인 카드로 간다. 카드는 담당 @dev · 수정으로 연다(있으면 고친다).
      await ledger(env).setOrder({
        ...(mail ? { mail } : {}),
        id: crypto.randomUUID(),
        title,
        request,
        thread,
        risk: 'high',
        by: 'operator',
        at: Date.now(),
        started: true,
      });
      const card = cardOf(env, task.channel, task.threadTs);
      if (!(await card.patch({ status: '수정', owner: 'dev' })))
        await card.open({
          channel: task.channel,
          threadTs: task.threadTs,
          goal: title,
          source: 'operator',
          owner: 'dev',
          status: '수정',
        });
      return `시작했어요. 진행은 ${workRunsUrl(env)} 에서 보이고, 끝나면 이 스레드에 결과가 올라와요(보통 10~30분).`;
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
  body?: string | null;
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
  /** T-11-325 실제 바뀐 파일 경로(agent-dev-publish.mjs). 위험도를 다시 판정한다. 옛 스크립트는 개수를 보냈다. */
  files?: string[] | number;
  /** CI 고치기: 이미 있는 PR 브랜치에 커밋을 얹었다(PR을 새로 열지 않았다). */
  fix?: boolean;
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
    const files = Array.isArray(r.files) ? r.files : [];
    const risk = files.length ? riskOf(files) : undefined;
    const order = await ledger(env).orderOf(r.thread);
    const expected = !order || order.by === 'operator' ? 'operator' : order.risk;
    // CI 고치기는 고친 횟수를 이어 가고, 리뷰는 diff가 바뀌었으니 다시 받는다.
    const prev = r.fix ? await ledger(env).devJob(r.branch) : undefined;
    await ledger(env).setDevJob(r.branch, {
      ...(prev?.fixes ? { fixes: prev.fixes } : {}),
      channel,
      threadTs,
      pr: r.pr,
      title: r.title ?? '',
      ...(risk ? { risk } : {}),
      expected,
    });
    const prUrl = `https://github.com/${env.GITHUB_REPO}/pull/${r.pr}`;
    await cardOfThread(env, r.thread)
      .patch({ link: `<${prUrl}|PR #${r.pr}>`, ...(risk ? { risk } : {}) })
      .catch(() => undefined);
    text = r.fix
      ? `${said || 'CI 실패를 고쳤어요.'}\n\n**PR #${r.pr}**에 고친 커밋을 올렸어요. ${prUrl}\nCI가 다시 돌고, 통과하면 #agent-approvals에 머지 승인 요청을 올려요.`
      : `${said || '고쳐서 PR을 올렸어요.'}\n\n**PR #${r.pr}** ${prUrl}\nCI가 끝나면 결과를 여기 알려 드릴게요. 통과하면 #agent-approvals에 머지 승인 요청을 올려요.`;
  } else if (isNoFix(said)) {
    // T-11-400 문의 작업을 "고칠 것 없음"으로 판정했다(커밋 없음). 카드는 닫고, 문의면 설명 답장 초안을 맡긴다.
    text = said;
    const order = await ledger(env).orderOf(r.thread);
    await cardOfThread(env, r.thread)
      .patch({ status: '닫힘', note: '판정: 고칠 것 없음' })
      .catch(() => undefined);
    if (order?.mail) {
      await supportFollowup(env, order, 'no-fix', said);
      text += '\n\n문의 메일에 보낼 설명 답장 초안을 @plan에게 맡겼어요.';
    }
  } else {
    text = `작업을 끝까지 넣지 못했어요. ${r.reason ?? ''}${said ? `\n\n${said}` : ''}`;
  }
  await devSlack(env)('chat.postMessage', threadReply(channel, threadTs, text, footer));
}

/** @dev 마지막 답이 "판정: 고칠 것 없음"으로 시작하는지(문의 작업, roles/dev-runner.md). */
export const isNoFix = (said: string) =>
  /^\s*(?:\*\*)?판정\s*[:：]\s*고칠 것 없음/.test(said.split('\n').find((l) => l.trim()) ?? '');

export type DevCi = { branch: string; sha: string; conclusion: string; url: string };

/** PR CI가 끝났을 때. 통과면 승인 카드, 실패면 스레드에 알린다. 취소(새 push로 밀림)는 넘긴다. */
export async function devCi(env: Env, c: DevCi, gh: () => Promise<Gh> = () => appGh(env)) {
  const job = await ledger(env).devJob(c.branch);
  if (!job) return 'unknown branch';
  if (c.conclusion === 'cancelled' || c.conclusion === 'skipped') return 'ignored';
  const slack = devSlack(env);
  if (c.conclusion !== 'success') {
    const g = await gh();
    const { data: pr } = await g<PullRequest>(`/pulls/${job.pr}`);
    if (pr.state !== 'open' || pr.head?.sha !== c.sha) return 'stale';
    const why = await startFix(env, g, c, job);
    if (!why) {
      await slack(
        'chat.postMessage',
        threadReply(
          job.channel,
          job.threadTs,
          `PR #${job.pr} CI가 실패했어요(${c.conclusion}). <${c.url}|실패 로그>를 붙여 한 번 고치게 했어요. 결과는 이 스레드에 올라와요.`,
        ),
      );
      return 'fixing';
    }
    await slack(
      'chat.postMessage',
      threadReply(
        job.channel,
        job.threadTs,
        `PR #${job.pr} CI가 실패했어요(${c.conclusion}). ${why} <${c.url}|CI 기록>을 보고 다시 지시해 주세요.`,
      ),
    );
    return 'failed';
  }
  const g = await gh();
  const { data: pr } = await g<PullRequest>(`/pulls/${job.pr}`);
  if (pr.state !== 'open' || pr.head?.sha !== c.sha) return 'stale';
  // 다른 모델 리뷰. 실패해도 카드는 올린다(카드에 "리뷰 못 함"이 붙는다).
  if (!job.review) {
    const order = await ledger(env).orderOf(`${job.channel}:${job.threadTs}`);
    const review = await reviewPr(env, g, pr, order?.request).catch((e: unknown) => {
      console.error('pr review failed', String(e).slice(0, 200));
      return undefined;
    });
    if (review) {
      job.review = review;
      await ledger(env).setDevJob(c.branch, job);
      await ledger(env).add('dev', review.costUsd);
      await cardOf(env, job.channel, job.threadTs)
        .addCost('dev', review.costUsd)
        .catch(() => undefined);
      await slack(
        'chat.postMessage',
        threadReply(
          job.channel,
          job.threadTs,
          review.text,
          `${review.model} 리뷰 · $${review.costUsd.toFixed(3)}`,
        ),
      );
    }
  }
  const card = await slack('chat.postMessage', approvalCard(env, job, c));
  if (card.ts)
    await ledger(env).pendingAdd({
      ts: card.ts,
      channel: env.APPROVAL_CHANNEL,
      label: `머지 PR #${job.pr} ${job.title}`.slice(0, 120),
      at: Date.now(),
    });
  await cardOf(env, job.channel, job.threadTs)
    .patch({ status: '승인 대기' })
    .catch(() => undefined);
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

/**
 * CI가 실패한 @dev PR을 같은 브랜치에서 한 번 더 고치게 띄운다(agent-dev.yml branch · ci_run). 띄웠으면 null, 아니면 이유.
 * 횟수는 띄우기 전에 올려 둔다(같은 실패 알림이 두 번 와도 한 번만 띄운다).
 */
export async function startFix(env: Env, g: Gh, c: DevCi, job: DevJob): Promise<string | null> {
  if ((job.fixes ?? 0) >= MAX_FIXES) return `이미 ${MAX_FIXES}번 고치게 했어요.`;
  if (!/^agent-dev\/\d+$/.test(c.branch)) return '@dev가 연 브랜치가 아니에요.';
  const ciRun = /\/actions\/runs\/(\d+)/.exec(c.url)?.[1];
  if (!ciRun) return 'CI 실행 번호를 읽지 못했어요.';
  await ledger(env).setDevJob(c.branch, { ...job, fixes: (job.fixes ?? 0) + 1 });
  const thread = `${job.channel}:${job.threadTs}`;
  const order = await ledger(env).orderOf(thread);
  const request = [
    `PR #${job.pr}(${job.title})의 CI가 실패했다(${c.conclusion}). 실패 로그를 보고 CI가 통과하게 고친다.`,
    '- 실패를 고치는 데 필요한 것만 바꾼다. 원래 지시 범위를 넘지 않고, 테스트를 지우거나 건너뛰게 만들어 통과시키지 않는다.',
    '- 실패가 이 PR과 무관하면(main에서 온 실패 · 일시 오류 · 러너 문제) 고치지 말고 커밋 없이 결과에 그렇게 적는다.',
    '',
    '원래 지시:',
    order?.request ?? '(기록 없음)',
  ].join('\n');
  const why = await dispatchWork(env, g, {
    title: `CI 고치기 PR #${job.pr}`,
    request,
    thread,
    branch: c.branch,
    ciRun,
  });
  if (why) await ledger(env).setDevJob(c.branch, job);
  else
    await cardOf(env, job.channel, job.threadTs)
      .patch({ status: '수정', note: `PR #${job.pr} CI 실패 고치기` })
      .catch(() => undefined);
  return why;
}

export function approvalCard(env: Env, job: DevJob, c: DevCi) {
  const prUrl = `https://github.com/${env.GITHUB_REPO}/pull/${job.pr}`;
  const value = JSON.stringify({ pr: job.pr, sha: c.sha, branch: c.branch });
  const text = [
    `*머지 승인 요청* · <${prUrl}|PR #${job.pr}> ${job.title}`,
    `• 무엇을: 위 PR을 main에 squash 머지`,
    `• 왜: 운영자 지시(<${threadLink(env, job.channel, job.threadTs)}|스레드>)`,
    `• 검사: <${c.url}|CI 통과> · 커밋 \`${c.sha.slice(0, 7)}\``,
    ...riskLines(job),
    ...reviewLines(job),
    `• 되돌리기: main에서 이 PR을 revert. 운영 배포는 머지 뒤 배포 승인 카드로 따로 받아요.`,
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

/** 승인 카드의 다른 모델 리뷰 줄. 확인 필요면 문제 줄을 그대로 붙인다. */
export function reviewLines(job: Pick<DevJob, 'review'>): string[] {
  const r = job.review;
  if (!r) return ['• 리뷰: 못 받았어요. 바뀐 파일을 직접 확인해 주세요.'];
  if (r.verdict === 'ok') return [`• 리뷰(${r.model}): 문제 없음`];
  const issues = r.text
    .split('\n')
    .slice(1)
    .filter((l) => l.trim())
    .slice(0, 4)
    .map((l) => `   ${l.trim()}`);
  return [`• ⚠️ 리뷰(${r.model}): 확인 필요`, ...issues];
}

/** T-11-325 승인 카드의 위험도 줄. 실제 경로가 시작할 때 예상보다 높으면 경고를 붙인다. */
export function riskLines(job: Pick<DevJob, 'risk' | 'expected'>): string[] {
  if (!job.risk) return [];
  const line = `• 위험도: ${RISK_LABEL[job.risk]}(실제 바뀐 경로 기준)`;
  if (!job.expected || job.expected === 'operator') return [line];
  if (!above(job.risk, job.expected))
    return [`${line} · 시작할 때 예상 ${RISK_LABEL[job.expected]}`];
  return [
    line,
    `• ⚠️ 시작할 때 예상은 ${RISK_LABEL[job.expected]}이었어요. ${job.risk === 'high' ? '높음은 운영자가 직접 맡겨야 하는 범위예요' : '중간은 시작 카드 승인을 거쳐야 하는 범위예요'}. 머지 전에 바뀐 파일을 직접 확인해 주세요.`,
  ];
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
  if (p.type === 'block_actions' && act && DEPLOY_ACTIONS.includes(act.action_id))
    return deployInteraction(env, p, gh);
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
    const rejected = await ledger(env).devJob(v.branch);
    if (rejected)
      await cardOf(env, rejected.channel, rejected.threadTs)
        .patch({ status: '보류', note: `PR #${v.pr} 머지 거절` })
        .catch(() => undefined);
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
  // T-11-312 머지한 main 커밋의 운영 배포 승인 카드를 이어서 올린다(카드가 실패해도 머지는 끝났다).
  const job = await ledger(env).devJob(v.branch);
  if (job)
    await cardOf(env, job.channel, job.threadTs)
      .patch({ status: '배포', next: null })
      .catch(() => undefined);
  const card = m.data.sha
    ? await postDeployCard(
        env,
        g,
        m.data.sha,
        job && { channel: job.channel, threadTs: job.threadTs },
      ).catch(() => null)
    : null;
  await finish(
    `<@${p.user.id}>님 승인으로 PR #${v.pr}을 머지했어요(\`${(m.data.sha ?? '').slice(0, 7)}\`). ${card?.posted ? '#agent-approvals에 운영 배포 승인 카드를 올렸어요.' : '운영 배포 카드는 올리지 못했어요. 배포가 필요하면 저에게 말해 주세요.'}`,
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
