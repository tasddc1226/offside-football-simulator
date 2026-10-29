// T-11-312 @dev(손흥민) 운영 배포 승인. 승인 머지 뒤나 운영자 지시로 #agent-approvals에 배포 승인 카드를 올리고,
// 운영자가 버튼을 누를 때만 Worker가 deploy-production.yml을 띄운다. 누르는 순간 main 최신 커밋과 같은지 다시 본다
// (워크플로도 expected_sha가 main 최신이 아니면 멈춘다). 같은 커밋 · 같은 모드는 한 번만 띄운다.
import { type Env } from './env.ts';
import type { Gh } from './github.ts';
import { ledger } from './ledger.ts';
import { chatClient, threadLink } from './chat.ts';
import { threadReply } from './slack.ts';

const WORKFLOW = 'deploy-production.yml';
const MIGRATION = /^apps\/api\/migrations\/[^/]+\.sql$/;
export const DEPLOY_ACTIONS = ['dev_deploy', 'dev_preflight', 'dev_deploy_reject'];

export type DeployPlan = {
  sha: string;
  /** 지난 운영 배포 태그(GitHub 최신 릴리즈). 없으면 null. */
  since: string | null;
  ahead: number;
  commits: string[];
  migrations: string[];
};
type Origin = { channel: string; threadTs: string };

const devSlack = (env: Env) => chatClient(env, 'dev');

/** 지난 운영 배포(최신 릴리즈 태그)와 이 커밋 사이에 무엇이 들어가는지. */
export async function deployPlan(g: Gh, sha: string): Promise<DeployPlan> {
  const { data: rel } = await g<{ tag_name?: string }>('/releases/latest');
  const since = rel.tag_name ?? null;
  if (!since) return { sha, since, ahead: 1, commits: [], migrations: [] };
  const { data: cmp } = await g<{
    ahead_by?: number;
    commits?: { commit: { message: string } }[];
    files?: { filename: string }[];
  }>(`/compare/${since}...${sha}`);
  return {
    sha,
    since,
    ahead: cmp.ahead_by ?? 0,
    commits: (cmp.commits ?? []).map((c) => c.commit.message.split('\n')[0]!).reverse(),
    migrations: (cmp.files ?? []).map((f) => f.filename).filter((f) => MIGRATION.test(f)),
  };
}

export function deployCard(env: Env, plan: DeployPlan, origin?: Origin) {
  const short = plan.sha.slice(0, 7);
  const commitUrl = `https://github.com/${env.GITHUB_REPO}/commit/${plan.sha}`;
  const shown = plan.commits.slice(0, 8).map((t) => `   – ${t}`);
  const text = [
    `*운영 배포 승인 요청* · main <${commitUrl}|\`${short}\`>`,
    `• 무엇을: \`${WORKFLOW}\` 운영 배포(API · 웹 · 앱 OTA · 릴리즈 태그)`,
    `• 바뀐 것: ${plan.since ? `\`${plan.since}\` 뒤 ${plan.ahead}커밋` : '지난 배포 태그 없음'}`,
    ...shown,
    ...(plan.commits.length > shown.length
      ? [`   – 그 밖에 ${plan.commits.length - shown.length}커밋`]
      : []),
    plan.migrations.length
      ? `• 마이그레이션: ${plan.migrations.map((m) => `\`${m.split('/').pop()}\``).join(' · ')} — 프리플라이트를 먼저 돌려 보세요`
      : '• 마이그레이션: 없음',
    ...(origin ? [`• 요청: <${threadLink(env, origin.channel, origin.threadTs)}|스레드>`] : []),
    '• 되돌리기: main에서 revert한 뒤 다시 배포. 운영 DB 마이그레이션은 되돌리지 않아요.',
  ].join('\n');
  const value = JSON.stringify({ sha: plan.sha, ...(origin ? { o: origin } : {}) });
  const button = (label: string, action_id: string, style?: 'primary' | 'danger') => ({
    type: 'button',
    text: { type: 'plain_text', text: label },
    ...(style ? { style } : {}),
    action_id,
    value,
  });
  return {
    channel: env.APPROVAL_CHANNEL,
    text: `운영 배포 승인 요청 ${short}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [
          ...(plan.migrations.length ? [button('프리플라이트', 'dev_preflight')] : []),
          button('승인하고 배포', 'dev_deploy', 'primary'),
          button('거절', 'dev_deploy_reject', 'danger'),
        ],
      },
    ],
  };
}

/** 배포 승인 카드를 올린다. 지난 배포 뒤 바뀐 커밋이 없으면 올리지 않고 'nothing'. */
export async function postDeployCard(env: Env, g: Gh, sha: string, origin?: Origin) {
  const plan = await deployPlan(g, sha);
  if (plan.ahead === 0) return { posted: false as const, plan };
  const posted = await devSlack(env)('chat.postMessage', deployCard(env, plan, origin));
  if (posted.ts)
    await ledger(env).pendingAdd({
      ts: posted.ts,
      channel: env.APPROVAL_CHANNEL,
      label: `운영 배포 ${sha.slice(0, 7)}`,
      at: Date.now(),
    });
  return { posted: true as const, plan };
}

type Interaction = {
  type: string;
  user: { id: string };
  channel?: { id: string };
  message?: { ts: string; blocks?: unknown[] };
  actions?: { action_id: string; value: string }[];
};

/** 배포 승인 버튼. 운영자가 아니면 아무것도 하지 않는다. */
export async function deployInteraction(env: Env, p: Interaction, gh: () => Promise<Gh>) {
  const act = p.actions![0]!;
  const slack = devSlack(env);
  const channel = p.channel?.id ?? env.APPROVAL_CHANNEL;
  const v = JSON.parse(act.value) as { sha: string; o?: Origin };
  const blocks = (p.message?.blocks ?? []) as unknown[];
  /** keep: 버튼을 남긴다(프리플라이트 뒤 배포를 누를 수 있게). */
  const finish = async (line: string, keep = false) => {
    if (p.message?.ts)
      await slack('chat.update', {
        channel,
        ts: p.message.ts,
        text: line,
        blocks: [
          ...blocks.slice(0, keep ? 2 : 1),
          { type: 'context', elements: [{ type: 'mrkdwn', text: line }] },
        ],
      });
    if (v.o) await slack('chat.postMessage', threadReply(v.o.channel, v.o.threadTs, line));
  };
  if (p.user.id !== env.OPERATOR_USER_ID) {
    await slack('chat.postEphemeral', {
      channel,
      user: p.user.id,
      text: '운영 배포 승인은 운영자만 할 수 있어요.',
    });
    return 'forbidden';
  }
  const mode =
    act.action_id === 'dev_preflight'
      ? 'preflight'
      : act.action_id === 'dev_deploy'
        ? 'deploy'
        : null;
  const record = (action: 'deploy' | 'preflight' | 'deploy_reject', result: string) =>
    ledger(env).recordApproval({
      pr: 0,
      sha: v.sha,
      action,
      user: p.user.id,
      at: Date.now(),
      result,
    });
  const short = v.sha.slice(0, 7);
  if (!mode) {
    await record('deploy_reject', 'rejected');
    await finish(`<@${p.user.id}>님이 \`${short}\` 운영 배포를 거절했어요.`);
    return 'rejected';
  }
  const g = await gh();
  const { data: head } = await g<{ sha?: string }>('/commits/main');
  if (head.sha !== v.sha) {
    await record(mode, `stale: main ${head.sha ?? '?'}`);
    const fresh = head.sha ? await postDeployCard(env, g, head.sha, v.o) : null;
    await finish(
      `\`${short}\`은 배포하지 않았어요. 그 뒤 main이 \`${(head.sha ?? '?').slice(0, 7)}\`로 바뀌었어요.${fresh?.posted ? ' 새 카드를 올렸어요.' : ''}`,
    );
    return 'stale';
  }
  if (!(await ledger(env).claimDeploy(v.sha, mode))) {
    await finish(
      `\`${short}\` ${mode === 'deploy' ? '배포' : '프리플라이트'}는 이미 띄웠어요.`,
      mode === 'preflight',
    );
    return 'duplicate';
  }
  const r = await g(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    body: {
      ref: 'main',
      inputs: {
        mode,
        expected_sha: v.sha,
        ...(mode === 'deploy' ? { confirmation: 'DEPLOY_PRODUCTION' } : {}),
      },
    },
  });
  const runs = `https://github.com/${env.GITHUB_REPO}/actions/workflows/${WORKFLOW}`;
  if (r.status !== 204) {
    await record(mode, `failed ${r.status}`);
    await finish(
      `\`${short}\` ${mode === 'deploy' ? '배포' : '프리플라이트'}를 띄우지 못했어요 (GitHub ${r.status}).`,
      true,
    );
    return 'failed';
  }
  await record(mode, 'dispatched');
  await finish(
    mode === 'deploy'
      ? `<@${p.user.id}>님 승인으로 \`${short}\` 운영 배포를 시작했어요. <${runs}|진행 보기> · 끝나면 @mkt가 업데이트 요약 카드를 올려요.`
      : `<@${p.user.id}>님이 \`${short}\` 프리플라이트를 띄웠어요(<${runs}|진행 보기>). 통과하면 이 카드에서 배포를 누르세요.`,
    mode === 'preflight',
  );
  return mode;
}
