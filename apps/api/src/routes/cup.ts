import {
  CupMatchResponseSchema,
  CupMeResponseSchema,
  CupResponseSchema,
  OwnerItemsResponseSchema,
  type CupMatch,
  type CupPhase,
  type CupResponse,
} from '@offside/contracts';
import {
  CUP_GROUP_ROUNDS,
  CUP_ROUNDS,
  cupById,
  currentCup,
  lockAt,
  type CupDef,
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
import { countOpenListingsAmong } from '../db/repos/market.js';
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
  type CupEntryRow,
  type CupMatchRow,
  type CupStateRow,
} from '../team/cup.js';
import { cupSchedule } from '../team/cupSchedule.js';
import { lineupsOf, toMatch } from '../team/match.js';
import { filledCount } from '../team/sim.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok } from './shared.js';
import { cupKo } from '../cupText.js';

// T-11-145 오프사이드 컵(조회·신청·취소)과 구단주 아이템(선수 후보 리롤권).

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
