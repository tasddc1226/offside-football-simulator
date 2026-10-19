// ADR-015 슬랙 에이전트 Worker. 슬랙 이벤트를 받아 서명을 확인하고 3초 안에 200을 돌려준 뒤, 일은 스레드 객체에 넘긴다.
import { refreshSocialToken } from './social.ts';
import {
  calledRoles,
  enabled,
  isRole,
  list,
  signingSecret,
  stripCalls,
  type Env,
  type Role,
} from './env.ts';
import { alertSignature, kstDay, ledger } from './ledger.ts';
import { collect, triagePrompt, type DcCursor, type Reaction } from './reactions.ts';
import { devCi, devInteraction, devResult, type DevCi, type DevResult } from './dev.ts';
import { verifySlack } from './slack.ts';
import { scanSupport, supportInteraction } from './support.ts';
import { REVIEW_ACTIONS, reviewInteraction, scanReviews } from './reviews.ts';
import { threadOf, type Task } from './thread.ts';
import { START_ACTIONS, startInteraction } from './captain.ts';
import { afterDeploy, approvalsBundle, captainMorning, watchStatus } from './team.ts';

export { AgentThread } from './thread.ts';
export { AgentLedger } from './ledger.ts';
export { WorkCard } from './card.ts';

type SlackEvent = {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  app_id?: string;
  bot_profile?: { app_id?: string };
  text?: string;
  channel: string;
  ts: string;
  thread_ts?: string;
};

const IGNORED_SUBTYPES = new Set([
  'message_changed',
  'message_deleted',
  'channel_join',
  'channel_leave',
  'channel_topic',
  'channel_purpose',
]);
const stripMentions = (s: string) => s.replace(/<@[A-Z0-9]+>/g, '').trim();

/** 이 역할이 맡을 일인지 고른다. 아니면 null. */
export function decide(
  env: Env,
  role: Role,
  eventId: string,
  ev: SlackEvent,
  botUser: string | undefined,
): Task | null {
  if (ev.subtype && IGNORED_SUBTYPES.has(ev.subtype)) return null;
  const appId = ev.app_id ?? ev.bot_profile?.app_id;
  // 에이전트 봇끼리 · 자기 메시지에는 반응하지 않는다(넘기기는 Worker 안에서 한다, handoff.ts).
  if (
    (appId && list(env.AGENT_APP_IDS).includes(appId)) ||
    (ev.user && list(env.AGENT_BOT_USERS).includes(ev.user))
  )
    return null;
  const text = ev.text ?? '';
  const base = { eventId, role, channel: ev.channel, sourceTs: ev.ts };
  const operator = ev.user === env.OPERATOR_USER_ID;
  if (ev.type === 'app_mention') {
    // 명령은 운영자만(ADR-015 보안).
    if (!operator) return null;
    return { ...base, kind: 'mention', threadTs: ev.thread_ts ?? ev.ts, text: stripMentions(text) };
  }
  if (ev.type !== 'message') return null;
  // 멘션은 app_mention으로 따로 오므로 message 쪽에서는 건너뛴다.
  if (botUser && text.includes(`<@${botUser}>`)) return null;
  if (
    role === 'ops' &&
    list(env.ALERT_CHANNELS).includes(ev.channel) &&
    !ev.thread_ts &&
    (ev.bot_id || ev.subtype === 'bot_message')
  ) {
    // 정상 복구 알림은 정리할 원인이 없다.
    if (text.trimStart().startsWith('✅')) return null;
    return { ...base, kind: 'alert', threadTs: ev.ts, text };
  }
  // 한글로 부른 글(`@이운재 …`)은 부른 역할만 멘션으로 받는다. 다른 역할을 불렀으면 스레드 주인도 답하지 않는다.
  const called = operator ? calledRoles(text) : [];
  if (called.length)
    return called.includes(role)
      ? {
          ...base,
          kind: 'mention',
          threadTs: ev.thread_ts ?? ev.ts,
          text: stripCalls(stripMentions(text)),
        }
      : null;
  // T-11-325: 멘션 없는 답글 · 글로는 깨우지 않는다(불필요한 호출 줄이기). 일을 시키려면 봇을 멘션하거나 `@이름`으로 부른다.
  return null;
}

/** 역할 → 봇 사용자 ID(AGENT_BOT_USERS 순서는 ops · plan · dev · mkt). */
const botUserOf = (env: Env, role: Role) =>
  list(env.AGENT_BOT_USERS)[['ops', 'plan', 'dev', 'mkt'].indexOf(role)];

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/internal/run') return internalRun(req, url, env);
    const inter = /^\/slack\/(dev|plan|mkt)\/interactive$/.exec(url.pathname);
    if (inter && req.method === 'POST')
      return interactive(req, env, ctx, inter[1] as 'dev' | 'plan' | 'mkt');
    const m = /^\/slack\/([a-z]+)\/events$/.exec(url.pathname);
    if (url.pathname === '/health') return new Response('ok');
    if (!m || req.method !== 'POST') return new Response('not found', { status: 404 });
    const role = m[1]!;
    if (!isRole(role) || !enabled(env, role)) return new Response('not found', { status: 404 });
    const body = await req.text();
    const ok = await verifySlack(
      signingSecret(env, role),
      req.headers.get('x-slack-request-timestamp'),
      req.headers.get('x-slack-signature'),
      body,
    );
    if (!ok) return new Response('bad signature', { status: 401 });
    const payload = JSON.parse(body) as {
      type: string;
      challenge?: string;
      event_id?: string;
      event?: SlackEvent;
    };
    if (payload.type === 'url_verification') return Response.json({ challenge: payload.challenge });
    if (payload.type === 'event_callback' && payload.event && payload.event_id) {
      const task = decide(env, role, payload.event_id, payload.event, botUserOf(env, role));
      if (task) {
        const stub = threadOf(env, role, task.channel, task.threadTs);
        const run = async () => {
          // 같은 경보의 6시간 재안내는 24시간 안에 다시 정리하지 않는다(비용).
          if (task.kind === 'alert' && !(await ledger(env).freshAlert(alertSignature(task.text))))
            return;
          await stub.enqueue(task);
        };
        ctx.waitUntil(run().catch((e: unknown) => console.error('enqueue failed', String(e))));
      }
    }
    return new Response('');
  },

  /**
   * 3시간마다 47분 유저 반응 살피기(@plan), 매시 7분 고객 문의 메일(@plan), 매일 08:50 KST 주기 작업 보고(@ops) · 열린 카드
   * 목록 · 월요일 주간 회고(@plan) · 주간 유입 리포트(@mkt). T-11-325: 5분마다 서버 상태 감시, 10:00 · 18:00 KST 승인 대기 묶음.
   */
  async scheduled(ev: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const log = (job: string) => (e: unknown) =>
      console.error(`${job} failed`, String(e).slice(0, 300));
    if (ev.cron === REPORT_CRON) {
      if (enabled(env, 'ops')) ctx.waitUntil(morningReport(env, ev.scheduledTime));
      if (enabled(env, 'plan'))
        ctx.waitUntil(captainMorning(env, ev.scheduledTime).catch(log('captain morning')));
      if (enabled(env, 'mkt') && isMonday(ev.scheduledTime))
        ctx.waitUntil(mktWeekly(env, ev.scheduledTime).catch(log('mkt weekly')));
      // T-11-395 · T-11-397 Threads · Instagram 토큰은 60일이면 끝나니 하루 한 번 보고 7일마다 갱신한다.
      for (const kind of ['threads', 'instagram'] as const)
        ctx.waitUntil(
          refreshSocialToken(kind, env, ev.scheduledTime).then(
            (r) => r === 'refreshed' && console.log(`${kind} token refreshed`),
            log(`${kind} token`),
          ),
        );
      return;
    }
    if (ev.cron === WATCH_CRON) {
      if (enabled(env, 'ops'))
        ctx.waitUntil(
          watchStatus(env, ev.scheduledTime).then(
            (r) => r.startsWith('ok') || console.log('watch', r),
            log('watch'),
          ),
        );
      return;
    }
    if (ev.cron === BUNDLE_CRON) {
      if (enabled(env, 'plan'))
        ctx.waitUntil(approvalsBundle(env, ev.scheduledTime).catch(log('approvals bundle')));
      return;
    }
    if (ev.cron === SUPPORT_CRON) {
      if (enabled(env, 'plan'))
        ctx.waitUntil(
          scanSupport(env, ev.scheduledTime).then(
            (r) => r.mails && console.log('support', JSON.stringify(r)),
            (e: unknown) => console.error('support scan failed', String(e).slice(0, 300)),
          ),
        );
      // T-11-328 스토어 리뷰도 같은 1시간 주기로 본다.
      if (enabled(env, 'plan'))
        ctx.waitUntil(
          scanReviews(env, ev.scheduledTime).then(
            (r) => r.reviews && console.log('reviews', JSON.stringify(r)),
            log('reviews scan'),
          ),
        );
      return;
    }
    if (enabled(env, 'plan')) ctx.waitUntil(scanReactions(env));
  },
} satisfies ExportedHandler<Env>;

/** wrangler.jsonc triggers와 같은 값. */
export const REPORT_CRON = '50 23 * * *';
export const SUPPORT_CRON = '7 * * * *';
export const WATCH_CRON = '*/5 * * * *';
export const BUNDLE_CRON = '0 1,9 * * *';

/** 23:50 UTC 일요일 = 월요일 08:50 KST. */
const isMonday = (ms: number) => new Date(ms + 9 * 3600_000).getUTCDay() === 1;

/** 월요일 아침 @mkt 주간 유입 리포트(GA4, 지난 7일). */
export async function mktWeekly(env: Env, now = Date.now()) {
  await threadOf(env, 'mkt', env.DESK_CHANNEL, 'weekly').enqueue({
    eventId: `mkt-weekly:${kstDay(now)}`,
    kind: 'report',
    role: 'mkt',
    channel: env.DESK_CHANNEL,
    threadTs: '',
    sourceTs: '',
    text: '',
  });
}

export async function morningReport(env: Env, now = Date.now(), eventId = `report:${kstDay(now)}`) {
  await threadOf(env, 'ops', env.DESK_CHANNEL, 'report').enqueue({
    eventId,
    kind: 'report',
    role: 'ops',
    channel: env.DESK_CHANNEL,
    threadTs: '',
    sourceTs: '',
    text: '',
  });
}

/**
 * 운영자 시험용: `POST /internal/run?job=reactions|report` (AGENTS_READ_TOKEN). reactions에 `dry=1`이면 커서를 옮기지
 * 않고 출처별 건수 · 오류만 돌려준다(글 내용은 돌려주지 않는다).
 */
async function internalRun(req: Request, url: URL, env: Env): Promise<Response> {
  const auth = req.headers.get('authorization') ?? '';
  if (
    req.method !== 'POST' ||
    !env.AGENTS_READ_TOKEN ||
    !sameText(auth, `Bearer ${env.AGENTS_READ_TOKEN}`)
  )
    return new Response('not found', { status: 404 });
  const job = url.searchParams.get('job');
  // 디시: GitHub Actions(scripts/dc-push.ts)가 커서를 받아 읽고, 정리할 글과 새 커서를 넣는다.
  if (job === 'dc-cursor') return Response.json({ cursor: (await ledger(env).dcCursor()) ?? null });
  if (job === 'dc-push') {
    const { items, cursor } = (await req.json()) as { items: Reaction[]; cursor: DcCursor };
    if (!Array.isArray(items) || !cursor || typeof cursor.post !== 'number')
      return new Response('bad body', { status: 400 });
    return Response.json({ pending: await ledger(env).pushDc(items.slice(0, 100), cursor) });
  }
  // @dev: agent-dev.yml 결과 · PR CI 결과(agent-dev-ci.yml).
  if (job === 'dev-result') {
    await devResult(env, (await req.json()) as DevResult);
    return Response.json({ ok: true });
  }
  if (job === 'dev-ci')
    return Response.json({ result: await devCi(env, (await req.json()) as DevCi) });
  // 운영 배포가 성공하면(agent-release.yml) 배포 상태 카드를 넘긴다(T-11-325).
  if (job === 'release') {
    const body = (await req.json()) as { sha: string };
    const cards = /^[0-9a-f]{40}$/.test(body.sha ?? '')
      ? await afterDeploy(env, body.sha).catch((e: unknown) => String(e).slice(0, 200))
      : 'bad sha';
    return Response.json({ cards });
  }
  // T-11-325 시험용: 서버 상태 감시 한 번 · 아침 카드 목록 · 승인 대기 묶음.
  if (job === 'watch') return Response.json({ result: await watchStatus(env) });
  if (job === 'cards') {
    await captainMorning(env);
    return Response.json({ ok: true });
  }
  if (job === 'bundle') return Response.json({ result: await approvalsBundle(env) });
  // 고객 문의: dry=1이면 커서를 옮기지 않고 새 문의 수만 돌려준다.
  if (job === 'support')
    return Response.json(
      await scanSupport(env, Date.now(), undefined, url.searchParams.get('dry') === '1'),
    );
  // 스토어 리뷰: dry=1이면 커서를 옮기지 않고 새 리뷰 수만 돌려준다.
  if (job === 'reviews')
    return Response.json(
      await scanReviews(env, Date.now(), undefined, url.searchParams.get('dry') === '1'),
    );
  if (job === 'report') {
    await morningReport(env, Date.now(), `report:manual:${Date.now()}`);
    return Response.json({ queued: 'report' });
  }
  if (job !== 'reactions') return new Response('unknown job', { status: 400 });
  if (url.searchParams.get('dry') === '1') {
    const { items, errors } = await collect(env, await ledger(env).cursors());
    items.push(...(await ledger(env).takeDc(true)));
    const bySource: Record<string, number> = {};
    for (const x of items) bySource[x.source] = (bySource[x.source] ?? 0) + 1;
    return Response.json({ bySource, errors });
  }
  return Response.json(await scanReactions(env));
}

/** 슬랙 버튼(@dev 머지 승인 · @plan 답장 승인). 서명을 확인하고 3초 안에 200을 돌려준 뒤 일은 뒤에서 한다. */
async function interactive(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  role: 'dev' | 'plan' | 'mkt',
): Promise<Response> {
  if (!enabled(env, role)) return new Response('not found', { status: 404 });
  const body = await req.text();
  const ok = await verifySlack(
    signingSecret(env, role),
    req.headers.get('x-slack-request-timestamp'),
    req.headers.get('x-slack-signature'),
    body,
  );
  if (!ok) return new Response('bad signature', { status: 401 });
  const raw = new URLSearchParams(body).get('payload');
  if (!raw) return new Response('');
  const p = JSON.parse(raw) as {
    message?: { ts?: string };
    actions?: { action_id?: string }[];
  };
  const action = p.actions?.[0]?.action_id ?? '';
  const handle =
    role === 'plan' && START_ACTIONS.includes(action)
      ? startInteraction
      : role === 'plan' && REVIEW_ACTIONS.includes(action)
        ? reviewInteraction
        : role === 'dev'
          ? devInteraction
          : role === 'plan'
            ? supportInteraction
            : null;
  if (!handle) return new Response('');
  ctx.waitUntil(
    handle(env, JSON.parse(raw))
      .then(async (r) => {
        console.log(`${role} interaction`, r);
        // T-11-325 승인 대기에서 빼고 대기 시간을 잰다. 버튼이 남는 결과(권한 없음 · 프리플라이트 · 띄우기 실패)는 그대로 둔다.
        if (p.message?.ts && !KEEP_PENDING.has(String(r)))
          await ledger(env).pendingDone(p.message.ts);
      })
      .catch((e: unknown) => console.error(`${role} interaction failed`, String(e))),
  );
  return new Response('');
}

const KEEP_PENDING = new Set(['forbidden', 'ignored', 'preflight', 'failed']);

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const kstNow = () =>
  new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);

export async function scanReactions(env: Env, now = Date.now()) {
  const book = ledger(env);
  const { items, cursors, errors } = await collect(env, await book.cursors(), now);
  if (errors.length) console.error('reactions: read failed', errors.join(' | '));
  // 읽은 데까지 커서를 먼저 옮긴다(정리가 실패해도 같은 글로 다시 돈을 쓰지 않는다).
  await book.setCursors(cursors);
  items.push(...(await book.takeDc()));
  if (!items.length) return { items: 0, errors };
  const task: Task = {
    eventId: `triage:${now}`,
    kind: 'triage',
    role: 'plan',
    channel: env.DESK_CHANNEL,
    threadTs: '',
    sourceTs: '',
    text: triagePrompt(items, kstNow()),
  };
  await threadOf(env, 'plan', env.DESK_CHANNEL, 'triage').enqueue(task);
  return { items: items.length, errors };
}
