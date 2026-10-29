// ADR-015 에이전트 Worker. 디스코드 게이트웨이(bridge.ts)가 받은 글과 버튼(discordRoutes.ts)을 역할 스레드 객체에 넘기고, 주기 작업을 돌린다.
import { refreshSocialToken } from './social.ts';
import { runKpiIngest } from './kpi.ts';
import { enabled, type Env } from './env.ts';
import { kstDay, ledger } from './ledger.ts';
import { collect, triagePrompt, type DcCursor, type Reaction } from './reactions.ts';
import { devCi, devResult, type DevCi, type DevResult } from './dev.ts';
import { scanSupport } from './support.ts';
import { scanReviews } from './reviews.ts';
import { threadOf, type Task } from './thread.ts';
import { discordInteraction } from './discordRoutes.ts';
import { bridgeOf } from './bridge.ts';
import { afterDeploy, approvalsBundle, captainMorning, watchStatus } from './team.ts';

export { AgentThread } from './thread.ts';
export { AgentLedger } from './ledger.ts';
export { WorkCard } from './card.ts';
export { DiscordBridge } from './bridge.ts';
export { decide } from './events.ts';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/internal/run') return internalRun(req, url, env);
    // T-11-576 디스코드 버튼(Interactions Endpoint URL).
    if (url.pathname === '/discord/interactions' && req.method === 'POST')
      return discordInteraction(req, env, ctx, KEEP_PENDING);
    if (url.pathname === '/health') return new Response('ok');
    return new Response('not found', { status: 404 });
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
      // T-11-572 운영 지표 대시보드: 어제 · 그제 GA4 · Meta 광고 지표를 운영 API에 넣는다.
      ctx.waitUntil(
        runKpiIngest(env, ev.scheduledTime).then((r) => {
          for (const x of r)
            if (x.error) console.error('kpi ingest failed', x.source, x.day, x.error);
        }, log('kpi ingest')),
      );
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
      // T-11-576 디스코드 게이트웨이가 끊겨 있으면 다시 잇는다(객체 알람이 1분마다 보고, 이건 알람이 멈췄을 때의 안전망).
      ctx.waitUntil(bridgeOf(env).ensure().catch(log('discord gateway')));
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
  if (job === 'discord-status') return Response.json(await bridgeOf(env).status());
  if (job === 'watch') return Response.json({ result: await watchStatus(env) });
  if (job === 'cards') {
    await captainMorning(env);
    return Response.json({ ok: true });
  }
  if (job === 'bundle') return Response.json({ result: await approvalsBundle(env) });
  // T-11-579 운영 지표 수집을 지금 한 번(kpi-ingest.yml 수동 실행). 08:50 정기 수집과 같은 어제 · 그제를 넣는다.
  if (job === 'kpi') return Response.json({ result: await runKpiIngest(env, Date.now()) });
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
