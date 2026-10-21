import {
  CupMatchResponseSchema,
  CupMeResponseSchema,
  CupResponseSchema,
  CupHomeResponseSchema,
  BuyRerollBodySchema,
  ScoutUseBodySchema,
  HomeGiftResponseSchema,
  OwnerItemsResponseSchema,
  RerollShopResponseSchema,
  BuyRewardBodySchema,
  RewardShopResponseSchema,
  REWARD_KINDS,
  type CupMatch,
  type CupOdds,
  type RewardShopResponse,
  type CupPhase,
  type CupResponse,
  type CupHomeResponse,
  type CupChampion,
  type CupDivisionInfo,
} from '@offside/contracts';
import { leagueLineupLocked } from '../team/league.js';
import {
  CUP_GROUP_ROUNDS,
  CUP_KO_ROUNDS,
  CUP_ROUNDS,
  CUP_HOME_AFTER_MS,
  cupById,
  cupFinalAt,
  cupRoundsOf,
  currentCup,
  divisionFor,
  divisionRank,
  editionCups,
  fitsDivision,
  HOME_GIFT,
  lockAt,
  OWNER_ITEMS,
  shopPriceAt,
  type CupDef,
  type RewardKind,
  type CupRound,
} from '@offside/contracts/cup';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import type { Context, Hono } from 'hono';
import type { Db } from '../db/client.js';
import { cupEntries, cupMatches } from '../db/schema.js';
import {
  myTeamIn,
  publicNamesOf,
  slotIdsOf,
  liveTeamsByIds,
  logoOf,
  teamLogosByIds,
  type MatchDetail,
} from '../db/repos/ownerTeams.js';
import {
  buyReroll,
  buyRewardWithFunds,
  rerollShopRules,
  buyScout,
  rewardShopRules,
  rewardSnapshot,
  shopSnapshot,
} from '../db/repos/itemShop.js';
import { claimHomeGift, homeGiftClaimed, ownerItemsOf, spendItem } from '../db/repos/iap.js';
import { countOpenListingsAmong } from '../db/repos/market.js';
import { newId } from '../db/ids.js';
import { getDb, type AppEnv } from '../env.js';
import { reqLang } from '../lang.js';
import { iapAccount, iapStores } from '../iap/verify.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import {
  cupEntriesOf,
  cupMatchesOf,
  cupMatchesIn,
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
import { cupTeamsOf, matchOddsOf, mineOdds, oddsOfLineups, parseOdds } from '../team/cupOdds.js';
import { filledCount } from '../team/sim.js';
import { kstTodayStart, requireOwner } from './ownerTeam.js';
import { kstWeekStart } from '../time.js';
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
import { registerCupPredictionRoutes } from './cupPredictions.js';
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
  odds: matchOddsOf(m.oddsJson),
});

export const cupInfo = (cup: CupDef) => ({
  id: cup.id,
  season: cup.season,
  edition: cup.edition,
  opensAt: cup.opensAt,
  closesAt: cup.closesAt,
  drawAt: cup.drawAt,
  rounds: cupRoundsOf(cup).map((round, i) => ({
    round,
    at: cup.rounds[i]!,
    lockAt: lockAt(cup.rounds[i]!),
  })),
  capacity: cup.capacity,
  minFilled: cup.minFilled,
  ...(cup.division ? { division: cup.division, ovrMax: cup.ovrMax ?? null } : {}),
});

/** T-11-410 같은 회차 구간들과 구간별 신청 수(쿼리 1번). 통합 대회면 undefined. */
async function divisionsOf(
  db: Db,
  cup: CupDef,
  all: readonly CupDef[],
): Promise<CupDivisionInfo[] | undefined> {
  if (!cup.division) return undefined;
  const siblings = editionCups(cup, all);
  const rows = await db
    .select({ cupId: cupEntries.cupId, n: sql<number>`count(*)` })
    .from(cupEntries)
    .where(
      and(
        inArray(
          cupEntries.cupId,
          siblings.map((c) => c.id),
        ),
        ne(cupEntries.status, 'withdrawn'),
      ),
    )
    .groupBy(cupEntries.cupId);
  const count = new Map(rows.map((r) => [r.cupId, r.n]));
  return siblings.map((c) => ({
    id: c.id,
    division: c.division!,
    ovrMax: c.ovrMax ?? null,
    entries: count.get(c.id) ?? 0,
  }));
}

const activeCount = (entries: readonly CupEntryRow[]) =>
  entries.filter((e) => e.status !== 'withdrawn').length;

async function cupView(
  db: Db,
  cup: CupDef,
  now: string,
  all: readonly CupDef[],
): Promise<CupResponse> {
  const [entries, matches, [state], divisions] = await Promise.all([
    cupEntriesOf(db, cup.id),
    cupMatchesOf(db, cup.id),
    cupStateOf(db, cup.id),
    divisionsOf(db, cup, all),
  ]);
  // 추첨 전에는 신청한 팀을 신청 순으로 보여 준다(T-11-160). 추첨 뒤에는 조에 들어간 팀만.
  const shown = entries.filter((e) => e.status !== 'withdrawn' && (!state || e.grp !== null));
  // T-11-228 경기는 그날 팀으로 치르므로 이름·감독·OVR도 지금 팀으로 보인다(팀이 없어졌으면 신청 때 값).
  const live = await liveTeamsByIds(
    db,
    shown.map((e) => e.teamId),
  );
  const current = (id: string) => {
    const t = live.get(id);
    return t && t.season === cup.season ? t : undefined;
  };
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
    teams: shown.map((e) => {
      const t = current(e.teamId);
      return {
        teamId: e.teamId,
        name: t?.name ?? e.name,
        owner: t?.manager ?? e.manager,
        logo: live.get(e.teamId)?.logo ?? null,
        ovr: t?.ovr ?? e.ovr,
      };
    }),
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
    ...(divisions ? { divisions } : {}),
  };
}

/**
 * T-11-405 내 다음 경기 예상 — 컵 경기(playCupMatch)와 같이 두 팀 명단으로 중립 경기 줄 힘 · 기대 득점을 내고 90분
 * 승 · 무 · 패를 계산한다. T-11-407 명단이 잠겨 계산해 둔 값이 있으면 그 값(모두에게 보이는 값과 같다), 없으면 지금 명단으로
 * 계산한다(쿼리 3번: 팀 1번 + 선발 · 감독 2번). 상대가 아직 없거나 어느 팀이 이번 시즌 팀이 아니면 null.
 */
export async function nextOddsOf(
  db: Db,
  cup: CupDef,
  next: CupMatchRow,
  mine: string,
): Promise<CupOdds | null> {
  if (!next.homeTeamId || !next.awayTeamId) return null;
  const homeMine = next.homeTeamId === mine;
  const stored = parseOdds(next.oddsJson);
  if (stored) return mineOdds(stored, homeMine);
  const team = await cupTeamsOf(db, cup, [next.homeTeamId, next.awayTeamId]);
  const home = team(next.homeTeamId);
  const away = team(next.awayTeamId);
  if (!home || !away) return null;
  return mineOdds(oddsOfLineups(await lineupsOf(db, cup.season, home, away), cup.season), homeMine);
}

const cupAndAll = async (c: Context<AppEnv>, selectedId?: string) => {
  const id = selectedId ?? c.req.param('cupId');
  const all = await cupSchedule(getDb(c));
  const cup = id === 'current' ? currentCup(nowIso(), all) : id ? cupById(id, all) : undefined;
  if (!cup) throw notFoundError(cupKo('notFound'), 'CUP_NOT_FOUND');
  return { cup, all };
};
const cupOf = async (c: Context<AppEnv>, selectedId?: string) =>
  (await cupAndAll(c, selectedId)).cup;

/**
 * T-11-410 'current'로 부른 구단주 요청을 그 사람의 구간으로 푼다: 같은 회차에 신청한 구간, 없으면 지금 팀 OVR로 들어갈 수
 * 있는 가장 낮은 구간(팀이 없으면 마스터). id를 직접 주었거나 통합 대회면 그대로.
 */
async function myDivision(
  db: Db,
  cup: CupDef,
  all: readonly CupDef[],
  profileId: string,
  current: boolean,
) {
  if (!current || !cup.division) return cup;
  const siblings = editionCups(cup, all);
  const [entered] = await db
    .select({ cupId: cupEntries.cupId })
    .from(cupEntries)
    .where(
      and(
        eq(cupEntries.profileId, profileId),
        inArray(
          cupEntries.cupId,
          siblings.map((x) => x.id),
        ),
        ne(cupEntries.status, 'withdrawn'),
      ),
    )
    .limit(1);
  if (entered) return cupById(entered.cupId, siblings) ?? cup;
  const [team] = await myTeamIn(db, profileId, cup.season);
  return team ? (divisionFor(siblings, team.ovr) ?? cup) : cup;
}

/** Two DB round trips including schedule lookup; never load team logos or match details for home. */
export async function cupHomeView(
  db: Db,
  cup: CupDef,
  now: string,
): Promise<Omit<CupHomeResponse, 'champion'>> {
  const roundOrder = sql.join(
    CUP_KO_ROUNDS.map((r, i) => sql`WHEN ${r} THEN ${i}`),
    sql` `,
  );
  const row = await db.get<{
    entries: number;
    drawn: number;
    groups: number | null;
    doneAt: string | null;
    knockout: number;
    round: CupRound | null;
    championName: string | null;
  }>(sql`
    SELECT
      (SELECT count(*) FROM cup_entries WHERE cup_id = ${cup.id} AND status <> 'withdrawn') AS entries,
      (SELECT count(*) FROM cup_entries WHERE cup_id = ${cup.id} AND status <> 'withdrawn' AND grp IS NOT NULL) AS drawn,
      s.groups, s.done_at AS doneAt,
      EXISTS(SELECT 1 FROM cup_matches WHERE cup_id = ${cup.id} AND round IN (${sql.join(
        CUP_KO_ROUNDS.map((r) => sql`${r}`),
        sql`, `,
      )})) AS knockout,
      (SELECT round FROM cup_matches WHERE cup_id = ${cup.id}
       AND round IN (${sql.join(
         CUP_KO_ROUNDS.map((r) => sql`${r}`),
         sql`, `,
       )})
       ORDER BY played_at IS NULL DESC,
         CASE WHEN played_at IS NULL THEN (CASE round ${roundOrder} END)
              ELSE -(CASE round ${roundOrder} END) END LIMIT 1) AS round,
      coalesce(CASE WHEN t.season = ${cup.season} THEN t.name END, e.name) AS championName
    FROM (SELECT 1) seed
    LEFT JOIN cup_state s ON s.cup_id = ${cup.id}
    LEFT JOIN cup_matches f ON f.cup_id = ${cup.id} AND f.round = 'f' AND f.played_at IS NOT NULL
    LEFT JOIN cup_entries e ON e.cup_id = ${cup.id} AND e.team_id = f.winner_team_id AND e.status <> 'withdrawn'
    LEFT JOIN owner_teams t ON t.id = f.winner_team_id
    LIMIT 1`);
  const phase: CupPhase =
    now < cup.opensAt
      ? 'soon'
      : now < cup.closesAt
        ? 'open'
        : row!.groups === null
          ? 'closed'
          : row!.groups === 0
            ? 'cancelled'
            : row!.doneAt
              ? 'done'
              : row!.knockout
                ? 'knockout'
                : 'group';
  return {
    cup: cupInfo(cup),
    phase,
    entries: row!.entries,
    teamCount: row!.groups === null ? row!.entries : row!.drawn,
    round: row!.round,
    championName: row!.championName,
  };
}

/**
 * T-11-290 홈 우승 팝업에 보여 줄 대회: 결승 뒤 CUP_HOME_AFTER_MS 안에 끝난 가장 최근 대회. 다음 대회 접수가 열려
 * currentCup이 바뀌어도 앞 대회 우승은 일주일 동안 남는다. 없으면 undefined.
 */
export function recentCupFor(now: string, cups: readonly CupDef[]): CupDef | undefined {
  const t = Date.parse(now);
  return (
    [...cups]
      .filter((c) => {
        const final = Date.parse(cupFinalAt(c));
        return final <= t && t < final + CUP_HOME_AFTER_MS;
      })
      // T-11-410 같은 회차 구간이 함께 끝나면 마스터 우승을 보인다.
      .sort(
        (a, b) =>
          cupFinalAt(b).localeCompare(cupFinalAt(a)) ||
          divisionRank(b.division) - divisionRank(a.division),
      )[0]
  );
}

/**
 * 그 대회의 우승 팀(마감 처리까지 끝났을 때만). 한 행 — 결승 승자 + 신청 때 값 + 지금 팀(이름·구단주·로고). 우승 팀이
 * 없어졌거나(다른 시즌) 결승이 몰수로 둘 다 없으면 신청 때 이름으로 보인다.
 */
export async function cupChampionView(db: Db, cup: CupDef): Promise<CupChampion | null> {
  const row = await db.get<{
    teamId: string | null;
    doneAt: string;
    entryName: string | null;
    entryManager: string | null;
    teamSeason: number | null;
    teamName: string | null;
    teamManager: string | null;
    logoJson: string | null;
  }>(sql`
    SELECT f.winner_team_id AS teamId, s.done_at AS doneAt, e.name AS entryName, e.manager AS entryManager,
      t.season AS teamSeason, t.name AS teamName, t.manager AS teamManager, t.logo_json AS logoJson
    FROM cup_state s
    JOIN cup_matches f ON f.cup_id = s.cup_id AND f.round = 'f' AND f.played_at IS NOT NULL
    LEFT JOIN cup_entries e ON e.cup_id = s.cup_id AND e.team_id = f.winner_team_id
    LEFT JOIN owner_teams t ON t.id = f.winner_team_id
    WHERE s.cup_id = ${cup.id} AND s.done_at IS NOT NULL
    LIMIT 1`);
  if (!row?.teamId) return null;
  const live = row.teamSeason === cup.season;
  const name = (live ? row.teamName : null) ?? row.entryName;
  const owner = (live ? row.teamManager : null) ?? row.entryManager;
  if (!name || !owner) return null;
  return {
    cupId: cup.id,
    season: cup.season,
    edition: cup.edition,
    ...(cup.division ? { division: cup.division } : {}),
    teamId: row.teamId,
    name,
    owner,
    logo: logoOf({ logoJson: row.logoJson }),
    doneAt: row.doneAt,
  };
}

/** 신청 자격(지금 팀 기준). 실제 선수 수는 선발을 다시 세어 본다(팔린 카드는 빠진다). */
async function eligibility(
  db: Db,
  cup: CupDef,
  profileId: string,
  now: string,
  entries: readonly CupEntryRow[],
  all: readonly CupDef[],
) {
  const [team] = await myTeamIn(db, profileId, cup.season);
  if (!team) return { ok: false, reason: 'no-team' as const, filled: 0, team };
  // T-11-410 같은 회차 다른 구간에 이미 신청했는가.
  const others = cup.division
    ? editionCups(cup, all)
        .filter((x) => x.id !== cup.id)
        .map((x) => x.id)
    : [];
  const [other] = others.length
    ? await db
        .select({ cupId: cupEntries.cupId })
        .from(cupEntries)
        .where(
          and(
            eq(cupEntries.profileId, profileId),
            inArray(cupEntries.cupId, others),
            ne(cupEntries.status, 'withdrawn'),
          ),
        )
        .limit(1)
    : [];
  const lineups = await lineupsOf(db, cup.season, team, team, { coaches: false });
  const filled = filledCount(lineups.home);
  const ids = slotIdsOf(team).filter((x): x is string => !!x);
  const listed = await countOpenListingsAmong(db, ids);
  // 아랫 구간 상한은 접수가 열린 뒤 cron이 채운다(그 몇 분 동안은 아직 열리지 않은 것으로).
  const capless = !!cup.division && cup.division !== 'master' && cup.ovrMax == null;
  const reason =
    now < cup.opensAt || now >= cup.closesAt || capless
      ? ('closed' as const)
      : filled < cup.minFilled
        ? ('not-enough' as const)
        : listed > 0
          ? ('listed' as const)
          : other
            ? ('entered-other' as const)
            : !fitsDivision(cup, team.ovr)
              ? ('over-cap' as const)
              : activeCount(entries) >= cup.capacity
                ? ('full' as const)
                : null;
  return { ok: reason === null, reason, filled, team };
}

/** 리롤권 상점 응답(T-11-244 스카우트권 포함). */
function shopView(
  snap: { reroll: number; scout: number; balance: number; bought: number; scoutBought: number },
  rules: Awaited<ReturnType<typeof rerollShopRules>>,
) {
  return {
    reroll: snap.reroll,
    balance: snap.balance,
    price: shopPriceAt(rules, snap.bought),
    bought: snap.bought,
    cap: rules.cap,
    scout: {
      have: snap.scout,
      price: shopPriceAt(rules.scout, snap.scoutBought),
      bought: snap.scoutBought,
      cap: rules.scout.cap,
    },
  };
}

export function registerCupRoutes(app: Hono<AppEnv>): void {
  registerCupPredictionRoutes(app, cupOf);
  app.get('/v1/cups/home', async (c) => {
    const data = await edgeCached(c, EDGE.cupHome, 30, async () => {
      const db = getDb(c);
      const now = nowIso();
      const all = await cupSchedule(db);
      const cup = currentCup(now, all);
      if (!cup) throw notFoundError(cupKo('notFound'), 'CUP_NOT_FOUND');
      // 우승 팝업용 최근 우승은 지금 보여 줄 대회와 다를 수 있다(다음 대회 접수가 열린 뒤). 끝난 대회가 있을 때만 한 행 더 읽는다.
      const recent = recentCupFor(now, all);
      const [home, champion, divisions] = await Promise.all([
        cupHomeView(db, cup, now),
        recent ? cupChampionView(db, recent) : null,
        divisionsOf(db, cup, all),
      ]);
      if (!divisions) return { ...home, champion };
      // T-11-410 구간 대회: 단계 · 라운드는 마스터 기준, 신청 수는 구간을 합한다(추첨 뒤 팀 수도 신청 수 합으로).
      const entries = divisions.reduce((n, d) => n + d.entries, 0);
      return {
        ...home,
        entries,
        teamCount: Math.max(home.teamCount, entries),
        champion,
        divisions,
      };
    });
    return ok(c, CupHomeResponseSchema, data, 200, PUBLIC_CACHE);
  });
  // 대회 한눈에: 일정·참가 수·조 순위·대진·결과. 누구나 본다. cupId 'current'는 지금 보여 줄 대회.
  app.get('/v1/cups/:cupId', async (c) => {
    const load = async () => {
      const { cup, all } = await cupAndAll(c);
      return cupView(getDb(c), cup, nowIso(), all);
    };
    // Bound the key space to the current public cup; personal eligibility always stays uncached.
    // T-11-410 구간 대회 id(회차마다 3개)도 엣지에 담는다 — 있는 대회 id만 키가 된다.
    const id = c.req.param('cupId');
    const data =
      id === 'current'
        ? await edgeCached(c, EDGE.cupCurrent, 30, load)
        : /-(junior|senior|master)$/.test(id)
          ? await edgeCached(c, EDGE.cupById(id), 30, load)
          : await load();
    return ok(c, CupResponseSchema, data, 200, PUBLIC_CACHE);
  });

  // 내 참가·자격·다음 경기·명단 잠금·리롤권.
  app.get('/v1/cups/:cupId/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const picked = await cupAndAll(c);
    const all = picked.all;
    const cup = await myDivision(db, picked.cup, all, me.id, c.req.param('cupId') === 'current');
    const now = nowIso();
    const [entries, matches, rerolls] = await Promise.all([
      cupEntriesOf(db, cup.id),
      cupMatchesOf(db, cup.id),
      ownerItemsOf(db, me.id).then((x) => x.reroll),
    ]);
    const mine = entries.find((e) => e.profileId === me.id);
    const el = await eligibility(db, cup, me.id, now, entries, all);
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
        cupId: cup.id,
        ovr: el.team?.ovr ?? null,
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
        nextOdds: next && mine ? await nextOddsOf(db, cup, next, mine.teamId) : null,
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
    const picked = await cupAndAll(c);
    const all = picked.all;
    // T-11-410 'current'로 신청하면(구간을 모르는 옛 앱) 내 OVR로 들어갈 가장 낮은 구간에 넣는다.
    const cup = await myDivision(db, picked.cup, all, me.id, c.req.param('cupId') === 'current');
    const now = nowIso();
    const entries = await cupEntriesOf(db, cup.id);
    if (entries.some((e) => e.profileId === me.id && e.status !== 'withdrawn'))
      return c.body(null, 204);
    const el = await eligibility(db, cup, me.id, now, entries, all);
    if (!el.ok || !el.team) {
      const msg = {
        closed: cupKo('closed'),
        'no-team': cupKo('noTeam', { season: cup.season }),
        'not-enough': cupKo('notEnough', { n: cup.minFilled }),
        listed: cupKo('listed'),
        full: cupKo('full'),
        'entered-other': cupKo('enteredOther'),
        'over-cap': cupKo('overCap', { n: cup.ovrMax ?? 0 }),
      };
      throw conflictError(
        msg[el.reason ?? 'closed'],
        `CUP_${(el.reason ?? 'closed').toUpperCase().replaceAll('-', '_')}`,
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
    const picked = await cupAndAll(c);
    const cup = await myDivision(
      db,
      picked.cup,
      picked.all,
      me.id,
      c.req.param('cupId') === 'current',
    );
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

  // 내 아이템 · 인앱 구매에 붙일 구단주 표시와 확인할 수 있는 스토어(T-11-174).
  app.get('/v1/items', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const items = await ownerItemsOf(getDb(c), me.id);
    const iap = { account: iapAccount(me.id), stores: iapStores(c.env, me.id) };
    return ok(c, OwnerItemsResponseSchema, { ...items, iap }, 200, NO_STORE);
  });

  // 아이템 1장 쓰기 — 선수 후보 리롤권(reroll) · 잠재력 강화권(boost, T-11-174) · 프리미엄 스카우트권(scout, T-11-196). 남은 장수를 돌려준다. 없으면 409.
  // 재시도가 두 장을 쓰지 않게 멱등 키를 쓴다. 강화권은 서버가 장수만 빼고, 강화는 응답을 받은 기기가 한다.
  const EMPTY = {
    reroll: ['noReroll', 'NO_REROLL'],
    boost: ['noBoost', 'NO_BOOST'],
    scout: ['noScout', 'NO_SCOUT'],
  } as const;
  // T-11-377 이름 변경권은 이름 변경 API(POST /v1/careers/:careerId/rename)로만 쓴다.
  for (const item of OWNER_ITEMS.filter((k) => k !== 'rename'))
    app.post(`/v1/items/${item}/use`, requireProfile, idempotency, async (c) => {
      const me = await requireOwner(c);
      // T-11-244 스카우트권은 천장 카운트를 같이 센다. 본문(hit)이 없으면 천장을 모르는 옛 앱이다.
      const body = item === 'scout' ? readBody(c, ScoutUseBodySchema) : {};
      const scout = { pity: body.hit !== undefined, hit: body.hit === true };
      const items = await spendItem(getDb(c), me.id, item, nowIso(), scout);
      if (!items) {
        const [key, code] = EMPTY[item as keyof typeof EMPTY];
        throw conflictError(cupKo(key), code);
      }
      return ok(c, OwnerItemsResponseSchema, items, 200, NO_STORE);
    });

  // T-11-275 홈 선물. 로그인한 구단주만(아니면 403 GOOGLE_LOGIN_REQUIRED) 한 번 받는다. 조회는 PK 한 번이고 홈을 열 때
  // 구단주 표시가 있는 기기만 부른다. 받기는 재시도가 두 번 받지 않게 멱등 키도 쓴다(받은 기록 PK가 최종 방어선).
  app.get('/v1/items/gift', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const claimed = await homeGiftClaimed(getDb(c), me.id);
    const { id, boost, scout } = HOME_GIFT;
    return ok(
      c,
      HomeGiftResponseSchema,
      { gift: claimed ? null : { id, boost, scout } },
      200,
      NO_STORE,
    );
  });
  app.post('/v1/items/gift/claim', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const items = await claimHomeGift(getDb(c), me.id, nowIso());
    if (!items) throw conflictError(cupKo('giftClaimed'), 'GIFT_CLAIMED');
    return ok(c, OwnerItemsResponseSchema, items, 200, NO_STORE);
  });

  // T-11-152 리롤권 상점: 가진 장수 · 구단 자금 · 다음 한 장 가격 · 오늘 산 장수와 하루 상한. 상점을 펼칠 때만 부른다.
  // T-11-244 이번 주 프리미엄 스카우트권(가진 장수 · 가격 · 산 장수 · 주간 상한)도 같은 왕복에 싣는다.
  app.get('/v1/items/shop', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const [snap, rules] = await Promise.all([
      shopSnapshot(db, me.id, kstTodayStart(now), kstWeekStart(now)),
      rerollShopRules(db),
    ]);
    return ok(c, RerollShopResponseSchema, shopView(snap, rules), 200, NO_STORE);
  });

  // T-11-152 리롤권 한 장 사기. 화면에서 본 가격을 함께 보낸다 — 그 사이 다른 기기에서 샀거나 운영 수치가 바뀌어
  // 가격이 다르면 409. 재시도가 두 장을 사지 않게 멱등 키를 쓴다. T-11-244 스카우트권은 한 주 상한으로 같은 길을 쓴다.
  for (const item of ['reroll', 'scout'] as const)
    app.post(`/v1/items/${item}/buy`, requireProfile, idempotency, async (c) => {
      const me = await requireOwner(c);
      const db = getDb(c);
      const input = readBody(c, BuyRerollBodySchema);
      const now = nowIso();
      const day = kstTodayStart(now);
      const week = kstWeekStart(now);
      const [snap, rules] = await Promise.all([
        shopSnapshot(db, me.id, day, week),
        rerollShopRules(db),
      ]);
      const r = item === 'scout' ? rules.scout : rules;
      const bought = item === 'scout' ? snap.scoutBought : snap.bought;
      const price = shopPriceAt(r, bought);
      if (price === null)
        throw r.cap === 0
          ? conflictError(cupKo(item === 'scout' ? 'scoutClosed' : 'shopClosed'), 'SHOP_CLOSED')
          : item === 'scout'
            ? conflictError(cupKo('shopWeekly', { n: r.cap }), 'WEEKLY_LIMIT')
            : conflictError(cupKo('shopDaily', { n: r.cap }), 'DAILY_LIMIT');
      if (input.price !== price) throw conflictError(cupKo('shopPriceChanged'), 'PRICE_CHANGED');
      // 잔액 행이 없거나 모자라면 batch 전에 막는다(행이 없으면 출금 UPDATE가 0행으로 지나가 공짜가 된다).
      if (snap.balance < price) throw fundsShort();
      const buy = item === 'scout' ? buyScout : buyReroll;
      const since = item === 'scout' ? week : day;
      let res: Awaited<ReturnType<typeof buyReroll>>;
      try {
        res = await buy(db, { id: newId('ipc'), profileId: me.id, price, bought, since, now });
      } catch (e) {
        // 같은 구단주가 동시에 영입·구매를 해 잔액이 모자라게 되면 CHECK 위반으로 batch 전체가 되돌아간다.
        if (isFundsCheck(e)) throw fundsShort();
        throw e;
      }
      // 같은 순간 다른 기기에서 한 장 먼저 샀다 — 다음 가격은 달라졌다.
      if (!res.won) throw conflictError(cupKo('shopPriceChanged'), 'PRICE_CHANGED');
      const next = {
        reroll: res.reroll,
        scout: res.scout,
        balance: res.balance,
        bought: snap.bought + (item === 'reroll' ? 1 : 0),
        scoutBought: snap.scoutBought + (item === 'scout' ? 1 : 0),
      };
      return ok(c, RerollShopResponseSchema, shopView(next, rules), 200, NO_STORE);
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

/** 컵에 참가 중인(탈락 전) 이 시즌 대회. 경기 목록은 명단 잠금 검사에서만 읽는다. */
async function activeCups(db: Db, profileId: string, season: number) {
  const rows = await activeEntriesOf(db, profileId);
  if (!rows.length) return [];
  const all = await cupSchedule(db);
  const out: { cup: CupDef; entry: CupEntryRow }[] = [];
  for (const entry of rows) {
    const cup = cupById(entry.cupId, all);
    if (!cup || cup.season !== season) continue;
    out.push({ cup, entry });
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
  ovr: number,
) {
  // T-11-418b 리그 경기도 1시간 전부터 끝날 때까지 명단을 잠근다.
  if (await leagueLineupLocked(db, profileId, season, now))
    throw conflictError(cupKo('leagueLocked'), 'LEAGUE_LINEUP_LOCKED');
  const active = await activeCups(db, profileId, season);
  if (!active.length) return;
  const matches = await cupMatchesIn(
    db,
    active.map(({ cup }) => cup.id),
  );
  let listed: Promise<number> | undefined;
  for (const { cup, entry } of active) {
    // T-11-410 구간 대회는 추첨 뒤 탈락 전까지 상한을 넘는 명단으로 바꿀 수 없다(접수 중에는 신청을 옮기면 된다).
    if (now >= cup.drawAt && !fitsDivision(cup, ovr))
      throw conflictError(
        cupKo('ovrCap', { division: cupKo(cup.division!), n: cup.ovrMax ?? 0 }),
        'CUP_OVR_CAP',
      );
    if (
      lineupLocked(
        matches.filter((m) => m.cupId === cup.id),
        entry.teamId,
        now,
      )
    )
      throw conflictError(cupKo('lineupLocked'), 'CUP_LINEUP_LOCKED');
    if (filled < cup.minFilled)
      throw conflictError(cupKo('minFilled', { n: cup.minFilled }), 'CUP_MIN_FILLED');
    if ((await (listed ??= countOpenListingsAmong(db, ids))) > 0)
      throw conflictError(cupKo('cardListed'), 'CUP_CARD_LISTED');
  }
}

/** T-11-310 감독 전향 검사: 컵 참가 중이면 지금 선발에 든 선수는 감독이 될 수 없다(명단이 비면 대회 최소 인원이 깨진다). */
export async function checkCupManager(db: Db, profileId: string, season: number, careerId: string) {
  if (!(await activeCups(db, profileId, season)).length) return;
  const [team] = await myTeamIn(db, profileId, season);
  if (team && slotIdsOf(team).includes(careerId))
    throw conflictError(cupKo('cardManager'), 'CUP_CARD_LOCKED');
}

/** T-11-145 판매 등록 검사(R2): 컵 참가 중이면 지금 선발에 든 선수는 내놓을 수 없다. */
export async function checkCupListing(db: Db, profileId: string, season: number, careerId: string) {
  if (!(await activeCups(db, profileId, season)).length) return;
  const [team] = await myTeamIn(db, profileId, season);
  if (team && slotIdsOf(team).includes(careerId))
    throw conflictError(cupKo('cardLocked'), 'CUP_CARD_LOCKED');
}
