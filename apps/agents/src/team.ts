// ADR-015 5 · 7단계 · 측정(T-11-325). 모델을 부르지 않는 정기 글과 사건 감지:
// - 매일 08:50 KST 열린 카드 목록(주장), 월요일엔 주간 회고(카드 · 리드타임 · 개입 · 승인 대기 · 비용)
// - 10:00 · 18:00 KST 승인 대기 묶음(1시간 넘게 안 눌린 카드)
// - 운영 배포 성공: 배포 상태 카드 → 사건이면 30 · 60분 확인 예약, 아니면 닫기(문의 작업이면 마무리 답장 초안, T-11-400)
// - 5분마다 공개 서버 상태(GET /v1/status, 엣지 60초 캐시라 운영 D1을 건드리지 않는다) → 두 칸 이어 나쁘면 @ops 사건
import { cardOf, kstClock, type CardSummary } from './card.ts';
import { ROLES, type Env, type Role } from './env.ts';
import { kstDay, ledger, type PendingApproval } from './ledger.ts';
import { chatClient, threadLink } from './chat.ts';

type Link = (channel: string, ts: string) => string;
import { supportFollowup } from './supportCase.ts';
import { threadOf } from './thread.ts';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** 이만큼 상태가 그대로면 아침 목록에 '멈춤'으로 표시한다. */
export const STALE_MS = DAY;
/** 승인 묶음에 넣는 대기 시간. */
const PENDING_MIN_MS = HOUR;

const planSlack = (env: Env) => chatClient(env, 'plan');

const age = (ms: number) =>
  ms >= DAY ? `${Math.floor(ms / DAY)}일` : `${Math.max(1, Math.round(ms / HOUR))}시간`;

/** 아침 열린 카드 목록. 열린 카드가 없으면 null(올리지 않는다). */
/** link: 스레드 링크(chat.ts threadLink). */
export function openCardsText(cards: CardSummary[], now: number, link: Link): string | null {
  const open = cards.filter((c) => c.status !== '닫힘').sort((a, b) => a.updatedAt - b.updatedAt);
  if (!open.length) return null;
  const stale = open.filter((c) => c.status !== '보류' && now - c.updatedAt > STALE_MS);
  const lines = open.map((c) => {
    const flag = stale.includes(c) ? '⏸ ' : '';
    const next = c.next ? ` · 다음 ${kstClock(c.next.at)} ${c.next.what}` : '';
    return `- ${flag}<${link(c.channel, c.threadTs)}|${c.goal.slice(0, 60)}> · ${c.status} · @${c.owner} · ${age(now - c.updatedAt)}째 그대로${next}`;
  });
  return [
    `**열린 작업 카드 ${open.length}개**${stale.length ? ` · 24시간 넘게 멈춘 카드 ${stale.length}개(⏸)` : ''}`,
    ...lines,
    ...(stale.length
      ? [
          '',
          '멈춘 카드는 스레드에서 무엇이 막혔는지 확인해 주세요. 끝난 일이면 저에게 닫아 달라고 하시면 돼요.',
        ]
      : []),
  ].join('\n');
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export type RetroInput = {
  cards: CardSummary[];
  /** 지난 7일 KST 날짜별 운영자 개입 · 역할별 비용. */
  touches: number;
  approvals: number;
  waits: number[];
  costs: Record<Role, number>;
  autoStarts: number;
};

/** 월요일 주간 회고(지난 7일). */
export function retroText(r: RetroInput, now = Date.now()): string {
  const since = now - 7 * DAY;
  const opened = r.cards.filter((c) => c.openedAt >= since);
  const closed = r.cards.filter((c) => c.closedAt && c.closedAt >= since);
  const stale = r.cards.filter(
    (c) => c.status !== '닫힘' && c.status !== '보류' && now - c.updatedAt > STALE_MS,
  );
  const lead = median(closed.map((c) => c.closedAt! - c.openedAt));
  const incidents = r.cards.filter((c) => c.source === 'incident' && c.openedAt >= since);
  const incidentLead = median(
    incidents.filter((c) => c.closedAt).map((c) => c.closedAt! - c.openedAt),
  );
  const wait = median(r.waits);
  const total = ROLES.reduce((a, k) => a + r.costs[k], 0);
  const perCard = closed.length ? closed.reduce((a, c) => a + c.costUsd, 0) / closed.length : null;
  const h = (ms: number | null) => (ms == null ? '없음' : age(ms));
  return [
    `**주간 회고 (${kstDay(since)} ~ ${kstDay(now - 1)})**`,
    `- 카드: 새로 ${opened.length} · 닫힘 ${closed.length} · 24시간 넘게 멈춤 ${stale.length}`,
    `- 들어와서 닫힐 때까지(중앙값): ${h(lead)}`,
    `- 사건: ${incidents.length}건 · 알아차림부터 닫힘까지(중앙값) ${h(incidentLead)}`,
    `- 운영자 개입: 멘션 · 답글 ${r.touches}번 · 승인 버튼 ${r.approvals}번 · 승인 대기(중앙값) ${h(wait)}`,
    `- 낮음 자동 시작: ${r.autoStarts}건`,
    `- 비용: ${ROLES.map((k) => `${k} $${r.costs[k].toFixed(2)}`).join(' · ')} (합 $${total.toFixed(2)})${perCard == null ? '' : ` · 닫힌 카드당 $${perCard.toFixed(2)}`}`,
    '',
    '위험도 단계 조정 · 역할 추가는 이 숫자로 정해요(ADR-015 6단계 · 미결 7~9).',
  ].join('\n');
}

export function pendingText(list: PendingApproval[], now: number, link: Link): string | null {
  const due = list.filter((p) => now - p.at >= PENDING_MIN_MS).sort((a, b) => a.at - b.at);
  if (!due.length) return null;
  return [
    `**승인 대기 ${due.length}건**`,
    ...due.map((p) => `- <${link(p.channel, p.ts)}|${p.label}> · ${age(now - p.at)}째`),
  ].join('\n');
}

const lastDays = (now: number, n: number) =>
  Array.from({ length: n }, (_, i) => kstDay(now - (i + 1) * DAY));

/** 매일 아침: 열린 카드 목록, 월요일엔 주간 회고(주장이 #agent-desk에 올린다). */
export async function captainMorning(env: Env, now = Date.now()) {
  const book = ledger(env);
  const cards = await book.cards(now);
  const slack = planSlack(env);
  const list = openCardsText(cards, now, (c, t) => threadLink(env, c, t));
  if (list)
    await slack('chat.postMessage', { channel: env.DESK_CHANNEL, text: list, blocks: md(list) });
  // 23:50 UTC 일요일 = 월요일 08:50 KST.
  if (new Date(now + 9 * HOUR).getUTCDay() !== 1) return;
  const days = lastDays(now, 7);
  const costs = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  let touches = 0;
  let autoStarts = 0;
  for (const d of days) {
    touches += await book.touches(d);
    autoStarts += await book.autoStarts(d);
    for (const r of ROLES) costs[r] += (await book.day(r, d)).costUsd;
  }
  const since = now - 7 * DAY;
  const text = retroText(
    {
      cards,
      touches,
      approvals: await book.approvalCount(since),
      waits: (await book.waits()).filter((w) => w.at >= since).map((w) => w.ms),
      costs,
      autoStarts,
    },
    now,
  );
  await slack('chat.postMessage', { channel: env.DESK_CHANNEL, text, blocks: md(text) });
}

export async function approvalsBundle(env: Env, now = Date.now()) {
  const text = pendingText(await ledger(env).pending(now), now, (c, t) => threadLink(env, c, t));
  if (!text) return 'none';
  await planSlack(env)('chat.postMessage', {
    channel: env.APPROVAL_CHANNEL,
    text,
    blocks: md(text),
  });
  return 'posted';
}

const md = (text: string) => [{ type: 'markdown', text }];

/**
 * 운영 배포 성공(agent-release.yml): 배포 상태 카드를 사건이면 확인 중(30 · 60분 확인 예약), 아니면 닫는다.
 * T-11-400 문의에서 온 작업이면 그 문의 메일에 마무리 답장 초안을 @plan에게 맡긴다.
 */
export async function afterDeploy(env: Env, sha: string, now = Date.now()) {
  const book = ledger(env);
  const cards = (await book.cards(now)).filter((c) => c.status === '배포');
  let checks = 0;
  let closed = 0;
  let replies = 0;
  for (const c of cards) {
    const card = cardOf(env, c.channel, c.threadTs);
    if (c.source === 'incident') {
      await card.scheduleChecks(sha, now);
      checks++;
    } else {
      await card.patch({
        status: '닫힘',
        link: `\`${sha.slice(0, 7)}\``,
        note: `운영 배포 ${sha.slice(0, 7)}로 나갔어요`,
      });
      closed++;
      if (c.source !== 'support') continue;
      const order = await book.orderOf(`${c.channel}:${c.threadTs}`);
      if (order && (await supportFollowup(env, order, 'deployed', `\`${sha.slice(0, 7)}\``)))
        replies++;
    }
  }
  return { checks, closed, replies };
}

/** 5분 칸 하나의 판정(app-core serverStatus.ts levelOf와 같은 기준). 요청이 적은 칸은 판정하지 않는다. */
const SLOW_AVG_MS = 800;
const SLOW_SHARE = 0.1;
const ERROR_SHARE = 0.02;
export const MIN_REQUESTS = 100;
type Bucket = { at: string; requests: number; avgMs: number; slow: number; errors: number };

export function bucketLevel(b: Bucket): 'ok' | 'slow' | 'down' | 'unknown' {
  if (b.requests < MIN_REQUESTS) return 'unknown';
  if (b.errors / b.requests >= ERROR_SHARE) return 'down';
  if (b.avgMs >= SLOW_AVG_MS || b.slow / b.requests >= SLOW_SHARE) return 'slow';
  return 'ok';
}

const BUCKET_MS = 5 * 60_000;
/** 이어서 나빠야 사건으로 보는 칸 수(10분). 상태 주소를 못 읽은 것도 같은 횟수면 사건이다. */
export const BAD_IN_A_ROW = 2;

/** 5분마다: 끝난 칸 중 새 칸만 보고, 두 칸 이어 나쁘면 @ops 사건(새 글, 6시간에 한 번). */
export async function watchStatus(env: Env, now = Date.now(), fetcher: typeof fetch = fetch) {
  const book = ledger(env);
  const w = await book.watch();
  let buckets: Bucket[];
  try {
    const r = await fetcher(`${env.API_BASE}/v1/status`, {
      headers: { accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    // 운영 API 응답은 `{ data: ServerStatus }`로 감싸 온다.
    const body = (await r.json()) as { data?: { buckets?: Bucket[] } };
    if (!Array.isArray(body.data?.buckets)) throw new Error('no buckets');
    buckets = body.data.buckets;
  } catch (e) {
    const fail = w.fail + 1;
    await book.setWatch({ ...w, fail });
    if (fail === BAD_IN_A_ROW)
      return openIncident(
        env,
        now,
        `서버 상태 주소(GET /v1/status)를 ${BAD_IN_A_ROW}번 이어 읽지 못했어요(${String(e).slice(0, 80)}).`,
      );
    return 'fetch failed';
  }
  const currentStart = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  const fresh = buckets
    .filter((b) => Date.parse(b.at) < currentStart && (!w.lastAt || b.at > w.lastAt))
    .sort((a, b) => a.at.localeCompare(b.at));
  let bad = w.bad;
  let worst: Bucket | undefined;
  for (const b of fresh) {
    const lv = bucketLevel(b);
    if (lv === 'slow' || lv === 'down') {
      bad++;
      worst = b;
    } else if (lv === 'ok') bad = 0;
  }
  const lastAt = fresh.at(-1)?.at ?? w.lastAt;
  await book.setWatch({ bad, fail: 0, ...(lastAt ? { lastAt } : {}) });
  if (bad >= BAD_IN_A_ROW && w.bad < BAD_IN_A_ROW && worst) {
    const lv = bucketLevel(worst) === 'down' ? '오류' : '느림';
    return openIncident(
      env,
      now,
      `서버 상태 판정이 ${bad}칸(${bad * 5}분) 이어 '${lv}'이에요. 마지막 칸 ${kstClock(Date.parse(worst.at))} KST: 요청 ${worst.requests} · 평균 ${worst.avgMs}ms · 1초 넘음 ${worst.slow} · 5xx ${worst.errors}.`,
    );
  }
  return `ok bad=${bad}`;
}

async function openIncident(env: Env, now: number, text: string) {
  if (!(await ledger(env).claimIncident(now))) return 'cooldown';
  await threadOf(env, 'ops', env.DESK_CHANNEL, 'incident').enqueue({
    eventId: `incident:watch:${now}`,
    kind: 'incident',
    role: 'ops',
    channel: env.DESK_CHANNEL,
    threadTs: '',
    sourceTs: '',
    text,
  });
  return 'incident';
}
