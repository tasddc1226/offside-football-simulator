import {
  CupMatchResponseSchema,
  CupMeResponseSchema,
  CupResponseSchema,
  BuyRerollBodySchema,
  OwnerItemsResponseSchema,
  RerollShopResponseSchema,
  BuyRewardBodySchema,
  RewardShopResponseSchema,
  REWARD_KINDS,
  type CupMatch,
  type RewardShopResponse,
  type CupPhase,
  type CupResponse,
} from '@offside/contracts';
import {
  CUP_GROUP_ROUNDS,
  CUP_ROUNDS,
  cupById,
  currentCup,
  lockAt,
  shopPriceAt,
  type CupDef,
  type RewardKind,
  type CupRound,
} from '@offside/contracts/cup';
import { and, eq, sql } from 'drizzle-orm';
import type { Context, Hono } from 'hono';
import type { Db } from '../db/client.js';
import { cupEntries, cupMatches, ownerItems } from '../db/schema.js';
import {
  myTeamIn,
  publicNamesOf,
  slotIdsOf,
  teamLogosByIds,
  type MatchDetail,
} from '../db/repos/ownerTeams.js';
import {
  buyReroll,
  buyRewardWithFunds,
  rerollShopRules,
  rewardShopRules,
  rewardSnapshot,
  shopSnapshot,
} from '../db/repos/itemShop.js';
import { countOpenListingsAmong } from '../db/repos/market.js';
import { newId } from '../db/ids.js';
import { getDb, type AppEnv } from '../env.js';
import { reqLang } from '../lang.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import {
  cupEntriesOf,
  cupMatchesOf,
  cupStateOf,
  groupTable,
  activeEntriesOf,
  lineupLocked,
  pullCupIfFull,
  type CupEntryRow,
  type CupMatchRow,
  type CupStateRow,
} from '../team/cup.js';
import { cupSchedule } from '../team/cupSchedule.js';
import { lineupsOf, toMatch } from '../team/match.js';
import { filledCount } from '../team/sim.js';
import { kstTodayStart, requireOwner } from './ownerTeam.js';
import {
  conflictError,
  fundsShort,
  isFundsCheck,
  NO_STORE,
  notFoundError,
  nowIso,
  ok,
  readBody,
} from './shared.js';
import { cupKo } from '../cupText.js';

// T-11-145 오프사이드 컵(조회·신청·취소)과 구단주 아이템(선수 후보 리롤권). T-11-152 구단 자금으로 리롤권 사기.

// 브라우저는 매번 다시 묻고(신청 직후 인원이 바로 보이게) 공유 캐시만 30초 둔다.
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=30';

function phaseOf(
  cup: CupDef,
  state: CupStateRow | undefined,
  matches: readonly CupMatchRow[],
  now: string,
): CupPhase {
  if (now < cup.opensAt) return 'soon';
  if (now < cup.closesAt) return 'open';
  if (!state) return 'closed';
  if (state.groups === 0) return 'cancelled';
  if (state.doneAt) return 'done';
  return matches.some((m) => !CUP_GROUP_ROUNDS.includes(m.round as CupRound))
    ? 'knockout'
    : 'group';
}

export const toCupMatch = (m: CupMatchRow): CupMatch => ({
  id: m.id,
  round: m.round as CupRound,
  group: m.grp || null,
  slot: m.slot,
  homeTeamId: m.homeTeamId,
  awayTeamId: m.awayTeamId,
  at: m.at,
  played: m.playedAt !== null,
  homeGoals: m.homeGoals,
  awayGoals: m.awayGoals,
  pens: m.pensHome === null || m.pensAway === null ? null : { home: m.pensHome, away: m.pensAway },
  winnerTeamId: m.winnerTeamId,
  forfeit: m.forfeit === 1,
});

export const cupInfo = (cup: CupDef) => ({
  id: cup.id,
  season: cup.season,
  edition: cup.edition,
  opensAt: cup.opensAt,
  closesAt: cup.closesAt,
  drawAt: cup.drawAt,
  rounds: CUP_ROUNDS.map((round, i) => ({
    round,
    at: cup.rounds[i]!,
    lockAt: lockAt(cup.rounds[i]!),
  })),
  capacity: cup.capacity,
  minFilled: cup.minFilled,
});

const activeCount = (entries: readonly CupEntryRow[]) =>
  entries.filter((e) => e.status !== 'withdrawn').length;

async function cupView(db: Db, cup: CupDef, now: string): Promise<CupResponse> {
  const [entries, matches, [state]] = await Promise.all([
    cupEntriesOf(db, cup.id),
    cupMatchesOf(db, cup.id),
    cupStateOf(db, cup.id),
  ]);
  const drawn = entries.filter((e) => e.grp !== null && e.status !== 'withdrawn');
  const logos = await teamLogosByIds(
    db,
    drawn.map((e) => e.teamId),
  );
  const groups =
    state && state.groups
      ? Array.from({ length: state.groups }, (_, i) => ({
          no: i + 1,
          standings: groupTable(entries, matches, state.seed, i + 1),
        }))
      : [];
  const final = matches.find((m) => m.round === 'f' && m.playedAt);
  return {
    cup: cupInfo(cup),
    phase: phaseOf(cup, state, matches, now),
    entries: activeCount(entries),
    teams: drawn.map((e) => ({
      teamId: e.teamId,
      name: e.name,
      owner: e.manager,
      logo: logos.get(e.teamId) ?? null,
      ovr: e.ovr,
    })),
    groups,
    matches: matches
      .sort(
        (a, b) =>
          CUP_ROUNDS.indexOf(a.round as CupRound) - CUP_ROUNDS.indexOf(b.round as CupRound) ||
          a.grp - b.grp ||
          a.slot - b.slot,
      )
      .map(toCupMatch),
    championTeamId: final?.winnerTeamId ?? null,
  };
}

const cupOf = async (c: Context<AppEnv>) => {
  const id = c.req.param('cupId');
  const all = await cupSchedule(getDb(c));
  const cup = id === 'current' ? currentCup(nowIso(), all) : id ? cupById(id, all) : undefined;
  if (!cup) throw notFoundError(cupKo('notFound'), 'CUP_NOT_FOUND');
  return cup;
};

export const rerollsOf = async (db: Db, profileId: string) => {
  const [row] = await db
    .select({ qty: ownerItems.qty })
    .from(ownerItems)
    .where(and(eq(ownerItems.profileId, profileId), eq(ownerItems.item, 'reroll')));
  return row?.qty ?? 0;
};

/** 신청 자격(지금 팀 기준). 실제 선수 수는 선발을 다시 세어 본다(팔린 카드는 빠진다). */
async function eligibility(
  db: Db,
  cup: CupDef,
  profileId: string,
  now: string,
  entries: readonly CupEntryRow[],
) {
  const [team] = await myTeamIn(db, profileId, cup.season);
  if (!team) return { ok: false, reason: 'no-team' as const, filled: 0, team };
  const lineups = await lineupsOf(db, cup.season, team, team);
  const filled = filledCount(lineups.home);
  const ids = slotIdsOf(team).filter((x): x is string => !!x);
  const listed = await countOpenListingsAmong(db, ids);
  const reason =
    now < cup.opensAt || now >= cup.closesAt
      ? ('closed' as const)
      : filled < cup.minFilled
        ? ('not-enough' as const)
        : listed > 0
          ? ('listed' as const)
          : activeCount(entries) >= cup.capacity
            ? ('full' as const)
            : null;
  return { ok: reason === null, reason, filled, team };
}

export function registerCupRoutes(app: Hono<AppEnv>): void {
  // 대회 한눈에: 일정·참가 수·조 순위·대진·결과. 누구나 본다. cupId 'current'는 지금 보여 줄 대회.
  app.get('/v1/cups/:cupId', async (c) => {
    const cup = await cupOf(c);
    return ok(c, CupResponseSchema, await cupView(getDb(c), cup, nowIso()), 200, PUBLIC_CACHE);
  });

  // 내 참가·자격·다음 경기·명단 잠금·리롤권.
  app.get('/v1/cups/:cupId/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const cup = await cupOf(c);
    const now = nowIso();
    const [entries, matches, rerolls] = await Promise.all([
      cupEntriesOf(db, cup.id),
      cupMatchesOf(db, cup.id),
      rerollsOf(db, me.id),
    ]);
    const mine = entries.find((e) => e.profileId === me.id);
    const el = await eligibility(db, cup, me.id, now, entries);
    const next = mine
      ? matches
          .filter(
            (m) => !m.playedAt && (m.homeTeamId === mine.teamId || m.awayTeamId === mine.teamId),
          )
          .sort((a, b) => a.at.localeCompare(b.at))[0]
      : undefined;
    return ok(
      c,
      CupMeResponseSchema,
      {
        entry: mine
          ? {
              teamId: mine.teamId,
              status: mine.status as 'active' | 'out' | 'champion' | 'withdrawn',
              group: mine.grp,
              stage: (mine.stage as never) ?? null,
              createdAt: mine.createdAt,
            }
          : null,
        eligibility: {
          ok: el.ok && (!mine || mine.status === 'withdrawn'),
          reason: el.reason,
          filled: el.filled,
        },
        next: next ? toCupMatch(next) : null,
        locked: mine?.status === 'active' ? lineupLocked(matches, mine.teamId, now) : false,
        rerolls,
      },
      200,
      NO_STORE,
    );
  });

  // 신청(접수 기간만, 정원 선착순). 이미 신청했으면 그대로 돌려준다(자연 멱등).
  app.post('/v1/cups/:cupId/entries', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const cup = await cupOf(c);
    const now = nowIso();
    const entries = await cupEntriesOf(db, cup.id);
    if (entries.some((e) => e.profileId === me.id && e.status !== 'withdrawn'))
      return c.body(null, 204);
    const el = await eligibility(db, cup, me.id, now, entries);
    if (!el.ok || !el.team) {
      const msg = {
        closed: cupKo('closed'),
        'no-team': cupKo('noTeam', { season: cup.season }),
        'not-enough': cupKo('notEnough', { n: cup.minFilled }),
        listed: cupKo('listed'),
        full: cupKo('full'),
      };
      throw conflictError(
        msg[el.reason ?? 'closed'],
        `CUP_${(el.reason ?? 'closed').toUpperCase().replace('-', '_')}`,
      );
    }
    const t = el.team;
    // 정원 검사와 넣기를 한 문장으로(동시에 마지막 자리를 노려도 정원을 넘지 않는다). 예전에 취소한 행은 되살린다.
    const res = await db.$client
      .prepare(
        `INSERT INTO cup_entries (cup_id, team_id, profile_id, name, manager, ovr, status, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, 'active', ?, ?
         WHERE (SELECT count(*) FROM cup_entries WHERE cup_id = ? AND status <> 'withdrawn') < ?
         ON CONFLICT (cup_id, team_id) DO UPDATE SET status = 'active', created_at = excluded.created_at,
           updated_at = excluded.updated_at, name = excluded.name, manager = excluded.manager, ovr = excluded.ovr`,
      )
      .bind(cup.id, t.id, me.id, t.name, t.manager, t.ovr, now, now, cup.id, cup.capacity)
      .run();
    if (!res.meta.changes) throw conflictError(cupKo('full'), 'CUP_FULL');
    // 마지막 자리였으면 접수를 닫고 일정을 당긴다.
    await pullCupIfFull(db, cup, now);
    return c.body(null, 204);
  });

  // 신청 취소(접수 기간만).
  app.delete('/v1/cups/:cupId/entries/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const cup = await cupOf(c);
    const now = nowIso();
    if (now >= cup.closesAt) throw conflictError(cupKo('withdrawClosed'), 'CUP_CLOSED');
    await db
      .update(cupEntries)
      .set({ status: 'withdrawn', updatedAt: now })
      .where(and(eq(cupEntries.cupId, cup.id), eq(cupEntries.profileId, me.id)));
    return c.body(null, 204);
  });

  // 컵 경기 상세(득점 기록). 누구나 본다. 선수 이름은 공개 이름·익명.
  app.get('/v1/cups/:cupId/matches/:matchId', async (c) => {
    const db = getDb(c);
    const cup = await cupOf(c);
    const [m] = await db
      .select()
      .from(cupMatches)
      .where(and(eq(cupMatches.cupId, cup.id), eq(cupMatches.id, c.req.param('matchId'))));
    if (!m || !m.playedAt || !m.detailJson)
      throw notFoundError(cupKo('matchNotFound'), 'CUP_MATCH_NOT_FOUND');
    const d = JSON.parse(m.detailJson) as MatchDetail;
    const ids = d.events
      .flatMap((e) => [e.scorer.careerId, e.assist?.careerId])
      .filter((x): x is string => !!x);
    const [names, logos] = await Promise.all([
      publicNamesOf(db, [...new Set(ids)]),
      teamLogosByIds(db, [d.home.teamId, d.away.teamId]),
    ]);
    const match = toMatch(
      {
        id: m.id,
        homeTeamId: d.home.teamId,
        homeGoals: m.homeGoals ?? 0,
        awayGoals: m.awayGoals ?? 0,
        createdAt: m.playedAt,
      },
      d,
      d.home.teamId,
      names,
      logos,
      reqLang(c),
    );
    // 공개 화면이라 '내 쪽' 선수 id를 보내지 않는다.
    match.events = match.events.map((e) => ({ ...e, scorerId: null, assistId: null }));
    return ok(
      c,
      CupMatchResponseSchema,
      {
        match,
        cup: {
          round: m.round as CupRound,
          group: m.grp || null,
          pens:
            m.pensHome === null || m.pensAway === null
              ? null
              : { home: m.pensHome, away: m.pensAway },
          forfeit: m.forfeit === 1,
        },
      },
      200,
      PUBLIC_CACHE,
    );
  });

  // 내 아이템.
  app.get('/v1/items', requireProfile, async (c) => {
    const me = await requireOwner(c);
    return ok(
      c,
      OwnerItemsResponseSchema,
      { reroll: await rerollsOf(getDb(c), me.id) },
      200,
      NO_STORE,
    );
  });

  // 선수 후보 리롤권 1장 쓰기. 남은 장수를 돌려준다. 없으면 409. 재시도가 두 장을 쓰지 않게 멱등 키를 쓴다.
  app.post('/v1/items/reroll/use', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const row = await db
      .update(ownerItems)
      .set({ qty: sql`${ownerItems.qty} - 1`, updatedAt: nowIso() })
      .where(
        and(
          eq(ownerItems.profileId, me.id),
          eq(ownerItems.item, 'reroll'),
          sql`${ownerItems.qty} > 0`,
        ),
      )
      .returning({ qty: ownerItems.qty });
    if (!row.length) throw conflictError(cupKo('noReroll'), 'NO_REROLL');
    return ok(c, OwnerItemsResponseSchema, { reroll: row[0]!.qty }, 200, NO_STORE);
  });

  // T-11-152 리롤권 상점: 가진 장수 · 구단 자금 · 다음 한 장 가격 · 오늘 산 장수와 하루 상한. 상점을 펼칠 때만 부른다.
  app.get('/v1/items/shop', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [{ reroll, balance, bought }, rules] = await Promise.all([
      shopSnapshot(db, me.id, kstTodayStart(nowIso())),
      rerollShopRules(db),
    ]);
    const shop = { reroll, balance, price: shopPriceAt(rules, bought), bought, cap: rules.cap };
    return ok(c, RerollShopResponseSchema, shop, 200, NO_STORE);
  });

  // T-11-152 리롤권 한 장 사기. 화면에서 본 가격을 함께 보낸다 — 그 사이 다른 기기에서 샀거나 운영 수치가 바뀌어
  // 가격이 다르면 409. 재시도가 두 장을 사지 않게 멱등 키를 쓴다.
  app.post('/v1/items/reroll/buy', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, BuyRerollBodySchema);
    const now = nowIso();
    const since = kstTodayStart(now);
    const [{ balance: funds, bought }, rules] = await Promise.all([
      shopSnapshot(db, me.id, since),
      rerollShopRules(db),
    ]);
    const price = shopPriceAt(rules, bought);
    if (price === null)
      throw rules.cap === 0
        ? conflictError(cupKo('shopClosed'), 'SHOP_CLOSED')
        : conflictError(cupKo('shopDaily', { n: rules.cap }), 'DAILY_LIMIT');
    if (input.price !== price) throw conflictError(cupKo('shopPriceChanged'), 'PRICE_CHANGED');
    // 잔액 행이 없거나 모자라면 batch 전에 막는다(행이 없으면 출금 UPDATE가 0행으로 지나가 공짜가 된다).
    if (funds < price) throw fundsShort();
    let res: Awaited<ReturnType<typeof buyReroll>>;
    try {
      res = await buyReroll(db, { id: newId('ipc'), profileId: me.id, price, bought, since, now });
    } catch (e) {
      // 같은 구단주가 동시에 영입·구매를 해 잔액이 모자라게 되면 CHECK 위반으로 batch 전체가 되돌아간다.
      if (isFundsCheck(e)) throw fundsShort();
      throw e;
    }
    // 같은 순간 다른 기기에서 한 장 먼저 샀다 — 다음 가격은 달라졌다.
    if (!res.won) throw conflictError(cupKo('shopPriceChanged'), 'PRICE_CHANGED');
    const next = bought + 1;
    const shop = {
      reroll: res.reroll,
      balance: res.balance,
      price: shopPriceAt(rules, next),
      bought: next,
      cap: rules.cap,
    };
    return ok(c, RerollShopResponseSchema, shop, 200, NO_STORE);
  });

  // T-11-153 광고 대신 구단 자금으로 받는 보상들의 값. 앱 · 웹이 그 보상 버튼을 보일 때만 부른다.
  app.get('/v1/items/rewards', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [snap, rules] = await Promise.all([
      rewardSnapshot(db, me.id, kstTodayStart(nowIso())),
      rewardShopRules(db),
    ]);
    return ok(c, RewardShopResponseSchema, rewardShop(snap, rules), 200, NO_STORE);
  });

  // T-11-153 보상 한 번을 구단 자금으로 받는다. 화면에서 본 가격을 함께 보낸다(다르면 409). 서버는 자금만 받고, 보상은
  // 응답을 받은 기기가 준다. 재시도가 두 번 받지 않게 멱등 키를 쓴다.
  app.post('/v1/items/rewards/buy', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, BuyRewardBodySchema);
    const now = nowIso();
    const since = kstTodayStart(now);
    const [snap, rules] = await Promise.all([
      rewardSnapshot(db, me.id, since),
      rewardShopRules(db),
    ]);
    const rule = rules[input.kind];
    const bought = snap.bought[input.kind];
    const price = shopPriceAt(rule, bought);
    if (price === null)
      throw rule.cap === 0
        ? conflictError(cupKo('rewardClosed'), 'SHOP_CLOSED')
        : conflictError(cupKo('rewardDaily', { n: rule.cap }), 'DAILY_LIMIT');
    if (input.price !== price) throw conflictError(cupKo('rewardPriceChanged'), 'PRICE_CHANGED');
    if (snap.balance < price) throw fundsShort();
    let res: Awaited<ReturnType<typeof buyRewardWithFunds>>;
    try {
      res = await buyRewardWithFunds(db, {
        id: newId('ipc'),
        profileId: me.id,
        kind: input.kind,
        price,
        bought,
        since,
        now,
      });
    } catch (e) {
      if (isFundsCheck(e)) throw fundsShort();
      throw e;
    }
    if (!res.won) throw conflictError(cupKo('rewardPriceChanged'), 'PRICE_CHANGED');
    const next = { balance: res.balance, bought: { ...snap.bought, [input.kind]: bought + 1 } };
    return ok(c, RewardShopResponseSchema, rewardShop(next, rules), 200, NO_STORE);
  });
}

/** 구단 자금 · 오늘 받은 횟수 · 수치로 보상 값 응답을 만든다. */
function rewardShop(
  snap: { balance: number; bought: Record<RewardKind, number> },
  rules: Record<RewardKind, { price: number; growth: number; cap: number }>,
): RewardShopResponse {
  const offers = Object.fromEntries(
    REWARD_KINDS.map((k) => [
      k,
      { price: shopPriceAt(rules[k], snap.bought[k]), bought: snap.bought[k], cap: rules[k].cap },
    ]),
  ) as RewardShopResponse['offers'];
  return { balance: snap.balance, offers };
}

/** 컵에 참가 중인(탈락 전) 이 시즌 대회와 그 경기들. 없으면 빈 배열. */
async function activeCups(db: Db, profileId: string, season: number) {
  const rows = await activeEntriesOf(db, profileId);
  if (!rows.length) return [];
  const all = await cupSchedule(db);
  const out: { cup: CupDef; entry: CupEntryRow; matches: CupMatchRow[] }[] = [];
  for (const entry of rows) {
    const cup = cupById(entry.cupId, all);
    if (!cup || cup.season !== season) continue;
    out.push({ cup, entry, matches: await cupMatchesOf(db, cup.id) });
  }
  return out;
}

/**
 * T-11-145 팀 저장 검사(R1·R2·R5): 컵 참가 중이면 경기 1시간 전부터 그 경기가 끝날 때까지 명단을 못 바꾸고, 실제 선수가
 * 자격 수보다 적어지거나 이적시장에 내놓은 선수를 선발에 넣을 수 없다.
 */
export async function checkCupLineup(
  db: Db,
  profileId: string,
  season: number,
  ids: readonly string[],
  filled: number,
  now: string,
) {
  for (const { cup, entry, matches } of await activeCups(db, profileId, season)) {
    if (lineupLocked(matches, entry.teamId, now))
      throw conflictError(cupKo('lineupLocked'), 'CUP_LINEUP_LOCKED');
    if (filled < cup.minFilled)
      throw conflictError(cupKo('minFilled', { n: cup.minFilled }), 'CUP_MIN_FILLED');
    if ((await countOpenListingsAmong(db, ids)) > 0)
      throw conflictError(cupKo('cardListed'), 'CUP_CARD_LISTED');
  }
}

/** T-11-145 판매 등록 검사(R2): 컵 참가 중이면 지금 선발에 든 선수는 내놓을 수 없다. */
export async function checkCupListing(db: Db, profileId: string, season: number, careerId: string) {
  if (!(await activeCups(db, profileId, season)).length) return;
  const [team] = await myTeamIn(db, profileId, season);
  if (team && slotIdsOf(team).includes(careerId))
    throw conflictError(cupKo('cardLocked'), 'CUP_CARD_LOCKED');
}
