import {
  CUP_GROUP_ROUNDS,
  CUP_KO_ROUNDS,
  CUP_REWARDS,
  CUP_ROUNDS,
  cupById,
  cupGroupCount,
  firstKoRound,
  lockAt,
  pullCupForward,
  roundAt,
  type CupDef,
  type CupRound,
  type CupStage,
} from '@offside/contracts/cup';
import { and, asc, eq, getTableColumns, inArray, isNotNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { cupEntries, cupMatches, cupState, ownerTeams, profiles } from '../db/schema.js';
import { cupKo, cupTitle } from '../cupText.js';
import { cupSchedule } from './cupSchedule.js';
import { eventNotificationStatements } from '../push/events.js';
import { lineupsOf, matchDetailOf } from './match.js';
import { penaltyShootout, simulateMatch } from './sim.js';
import {
  drawGroups,
  firstKoPairs,
  groupFixtures,
  groupStandings,
  koLoserStage,
  nextKoSlot,
} from './cupRules.js';

// T-11-145 오프사이드 컵 진행(5분 cron). 한 번에 할 수 있는 단계만 하고 끝낸다 — 실패하면 다음 cron이 같은 단계를 다시
// 한다. 쓰기는 모두 같은 자리에 두 번 쓰지 않게 막는다(추첨: cup_state 기본키, 경기: played_at IS NULL, 다음 라운드:
// INSERT OR IGNORE, 보상: rewarded_at IS NULL).

export type CupEntryRow = typeof cupEntries.$inferSelect;
/** 목록용 경기 행. 득점 기록(detail_json)은 경기 상세에서만 따로 읽는다. */
export type CupMatchRow = Omit<typeof cupMatches.$inferSelect, 'detailJson'>;
export type CupStateRow = typeof cupState.$inferSelect;

const FORFEIT_GOALS = 3;

export const cupEntriesOf = (db: Db, cupId: string) =>
  db
    .select()
    .from(cupEntries)
    .where(eq(cupEntries.cupId, cupId))
    .orderBy(asc(cupEntries.createdAt));
const MATCH_COLS = Object.fromEntries(
  Object.entries(getTableColumns(cupMatches)).filter(([k]) => k !== 'detailJson'),
) as Omit<ReturnType<typeof getTableColumns<typeof cupMatches>>, 'detailJson'>;
export const cupMatchesOf = (db: Db, cupId: string) =>
  db.select(MATCH_COLS).from(cupMatches).where(eq(cupMatches.cupId, cupId));
export const cupStateOf = (db: Db, cupId: string) =>
  db.select().from(cupState).where(eq(cupState.cupId, cupId));

/** 라운드 순서(경기 시각 순). */
const roundIdx = (r: string) => CUP_ROUNDS.indexOf(r as CupRound);

/** 명단이 잠겨 있는가: 아직 안 끝난 내 경기 중 잠금 시각(경기 1시간 전)이 지난 것이 있다. */
export const lineupLocked = (matches: readonly CupMatchRow[], teamId: string, now: string) =>
  matches.some(
    (m) =>
      !m.playedAt && (m.homeTeamId === teamId || m.awayTeamId === teamId) && lockAt(m.at) <= now,
  );

/** 조별 경기만 골라 순위 계산 입력으로. */
export const playedGroupOf = (matches: readonly CupMatchRow[], grp: number) =>
  matches
    .filter((m) => m.grp === grp && m.playedAt && m.homeTeamId && m.awayTeamId)
    .map((m) => ({
      home: m.homeTeamId!,
      away: m.awayTeamId!,
      homeGoals: m.homeGoals ?? 0,
      awayGoals: m.awayGoals ?? 0,
    }));

export function groupTable(
  entries: readonly CupEntryRow[],
  matches: readonly CupMatchRow[],
  seed: string,
  grp: number,
) {
  const ids = entries.filter((e) => e.grp === grp).map((e) => e.teamId);
  return groupStandings(ids, playedGroupOf(matches, grp), seed);
}

// ───────── 단계별 쓰기 ─────────

/** KST 'HH:MM'(추첨 알림의 첫 경기 시각). */
const kstHm = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(11, 16);

function rewardStatements(
  d1: D1Database,
  cup: CupDef,
  e: Pick<CupEntryRow, 'teamId' | 'profileId'>,
  stage: CupStage,
  now: string,
) {
  const status = stage === 'champion' ? 'champion' : 'out';
  return [
    d1
      .prepare(
        `UPDATE cup_entries SET stage = ?, status = ?, rewarded_at = ?, updated_at = ?
         WHERE cup_id = ? AND team_id = ? AND rewarded_at IS NULL`,
      )
      .bind(stage, status, now, now, cup.id, e.teamId),
    d1
      .prepare(
        `INSERT INTO owner_items (profile_id, item, qty, updated_at)
         SELECT ?, 'reroll', ?, ? WHERE changes() = 1
         ON CONFLICT (profile_id, item) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.updated_at`,
      )
      .bind(e.profileId, CUP_REWARDS[stage].rerolls, now),
    // 최종 성적·보상은 알림함에만 둔다. 같은 cron에 나가는 경기 결과 푸시와 겹치면 예산(60분 간격)에 밀려 사라진다.
    ...notify(
      d1,
      e.profileId,
      `cup:${cup.id}:result`,
      cupKo(stage === 'champion' ? 'championTitle' : 'outTitle', { cup: cupTitle(cup) }),
      cupKo('rewardBody', { stage: cupKo(stage), n: CUP_REWARDS[stage].rerolls }),
      now,
      false,
    ),
  ];
}

// 탭하면 구단주 화면(컵 배너)으로 간다. 앱 알림 target에 'cup'이 없어 구버전 앱도 읽는 'owner'를 쓴다.
const notify = (
  d1: D1Database,
  profileId: string,
  sourceKey: string,
  title: string,
  body: string,
  now: string,
  push = true,
) =>
  eventNotificationStatements(
    d1,
    {
      profileId,
      sourceKey,
      now,
      content: { kind: 'team', title, body, target: { type: 'screen', screen: 'owner' } },
    },
    // 원본 중복은 source_key가 막는다(앞 문장의 changes()에 기대지 않는다).
    { sql: '1' },
    { push },
  );

/** KST 'M/D HH:MM'(일정 안내). */
const kstWhen = (iso: string) => {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.toISOString().slice(11, 16)}`;
};

/**
 * 접수 중 정원이 다 찼으면 접수를 닫고 추첨·경기를 당긴다(contracts pullCupForward). 한 번만 당긴다 — 조건부 UPDATE와
 * source_key가 겹친 요청을 막는다. 신청한 구단주 모두에게 새 일정을 알린다. 당겼으면 새 일정을 돌려준다.
 */
export async function pullCupIfFull(db: Db, cup: CupDef, now: string) {
  const active = (await cupEntriesOf(db, cup.id)).filter((e) => e.status === 'active');
  if (active.length < cup.capacity) return null;
  const next = pullCupForward(cup, now);
  if (!next) return null;
  const d1 = db.$client;
  const res = await d1
    .prepare(
      `UPDATE cups SET closes_at = ?, draw_at = ?, rounds_json = ? WHERE id = ? AND closes_at = ? AND draw_at = ?`,
    )
    .bind(next.closesAt, next.drawAt, JSON.stringify(next.rounds), cup.id, cup.closesAt, cup.drawAt)
    .run();
  if (!res.meta.changes) return null;
  const title = cupKo('earlyTitle', { cup: cupTitle(cup) });
  const body = cupKo('earlyBody', { draw: kstWhen(next.drawAt), first: kstWhen(next.rounds[0]!) });
  await d1.batch(
    active.flatMap((e) => notify(d1, e.profileId, `cup:${cup.id}:early`, title, body, now)),
  );
  return next;
}

/** 추첨: 자격을 다시 보고, 조를 나누고, 조별 3라운드 경기를 만든다. 한 batch(트랜잭션). */
export async function drawCup(db: Db, cup: CupDef, now: string) {
  const d1 = db.$client;
  const entries = (await cupEntriesOf(db, cup.id)).filter((e) => e.status === 'active');
  const teams = entries.length
    ? await db
        .select({ team: ownerTeams })
        .from(ownerTeams)
        .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
        .where(
          inArray(
            ownerTeams.id,
            entries.map((e) => e.teamId),
          ),
        )
    : [];
  const byId = new Map(teams.map((t) => [t.team.id, t.team]));
  const ok = entries.filter((e) => {
    const t = byId.get(e.teamId);
    return t && t.season === cup.season && t.filled >= cup.minFilled;
  });
  const dropped = entries.filter((e) => !ok.includes(e));
  const groups = cupGroupCount(ok.length);
  const seed = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [
    d1
      .prepare(
        `INSERT INTO cup_state (cup_id, seed, groups, drawn_at, done_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(cup.id, seed, groups, now, groups ? null : now),
  ];
  for (const e of dropped)
    stmts.push(
      d1
        .prepare(
          `UPDATE cup_entries SET status = 'withdrawn', updated_at = ? WHERE cup_id = ? AND team_id = ?`,
        )
        .bind(now, cup.id, e.teamId),
      ...notify(
        d1,
        e.profileId,
        `cup:${cup.id}:dropped`,
        cupKo('droppedTitle', { cup: cupTitle(cup) }),
        cupKo('droppedBody', { n: cup.minFilled }),
        now,
      ),
    );
  if (!groups) {
    for (const e of ok)
      stmts.push(
        d1
          .prepare(
            `UPDATE cup_entries SET status = 'withdrawn', updated_at = ? WHERE cup_id = ? AND team_id = ?`,
          )
          .bind(now, cup.id, e.teamId),
        ...notify(
          d1,
          e.profileId,
          `cup:${cup.id}:cancelled`,
          cupKo('cancelledTitle', { cup: cupTitle(cup) }),
          cupKo('cancelledBody'),
          now,
        ),
      );
    await d1.batch(stmts);
    return { drawn: ok.length, groups };
  }
  const grp = drawGroups(
    ok.map((e) => ({ teamId: e.teamId, ovr: byId.get(e.teamId)!.ovr })),
    groups,
    seed,
  );
  for (const e of ok) {
    const t = byId.get(e.teamId)!;
    stmts.push(
      d1
        .prepare(
          `UPDATE cup_entries SET grp = ?, name = ?, manager = ?, ovr = ?, updated_at = ? WHERE cup_id = ? AND team_id = ?`,
        )
        .bind(grp.get(e.teamId)!, t.name, t.manager, t.ovr, now, cup.id, e.teamId),
      ...notify(
        d1,
        e.profileId,
        `cup:${cup.id}:draw`,
        cupKo('drawTitle', { cup: cupTitle(cup) }),
        cupKo('drawBody', { team: t.name, group: grp.get(e.teamId)!, time: kstHm(cup.rounds[0]!) }),
        now,
      ),
    );
  }
  for (let g = 1; g <= groups; g++) {
    // 조 안 순서는 OVR 높은 순(같으면 팀 id) — 일정이 입력 순서에 기대지 않게.
    const members = ok
      .filter((e) => grp.get(e.teamId) === g)
      .map((e) => byId.get(e.teamId)!)
      .sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id))
      .map((t) => t.id);
    groupFixtures(members).forEach((pairs, r) =>
      pairs.forEach(([home, away], slot) =>
        stmts.push(insertMatch(d1, cup, CUP_GROUP_ROUNDS[r]!, g, slot, home, away)),
      ),
    );
  }
  await d1.batch(stmts);
  return { drawn: ok.length, groups };
}

const insertMatch = (
  d1: D1Database,
  cup: CupDef,
  round: CupRound,
  grp: number,
  slot: number,
  home: string | null,
  away: string | null,
) =>
  d1
    .prepare(
      `INSERT OR IGNORE INTO cup_matches (id, cup_id, round, grp, slot, home_team_id, away_team_id, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId('cpm'), cup.id, round, grp, slot, home, away, roundAt(cup, round));

/** 경기 한 판을 치르고 적는다. 팀이 없거나(지워짐·다른 시즌) 선수가 없으면 0:3 몰수. */
export async function playCupMatch(
  db: Db,
  cup: CupDef,
  m: CupMatchRow,
  entries: ReadonlyMap<string, CupEntryRow>,
  now: string,
) {
  const d1 = db.$client;
  const ids = [m.homeTeamId, m.awayTeamId].filter((x): x is string => !!x);
  const rows = ids.length
    ? await db
        .select({ team: ownerTeams })
        .from(ownerTeams)
        .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
        .where(inArray(ownerTeams.id, ids))
    : [];
  const team = (id: string | null) => {
    const t = id ? rows.find((r) => r.team.id === id)?.team : undefined;
    return t && t.season === cup.season ? t : undefined;
  };
  const home = team(m.homeTeamId);
  const away = team(m.awayTeamId);
  const ko = !CUP_GROUP_ROUNDS.includes(m.round as CupRound);
  let hg: number;
  let ag: number;
  let pens: { home: number; away: number } | null = null;
  let forfeit = 0;
  let detail: string | null = null;
  if (home && away) {
    const lineups = await lineupsOf(db, cup.season, home, away);
    const result = simulateMatch(m.id, lineups.home, lineups.away, cup.season, { neutral: true });
    hg = result.homeGoals;
    ag = result.awayGoals;
    if (ko && hg === ag) pens = penaltyShootout(m.id, lineups.home, lineups.away);
    detail = JSON.stringify(matchDetailOf(home, away, lineups, result));
  } else {
    forfeit = 1;
    hg = home ? FORFEIT_GOALS : 0;
    ag = !home && away ? FORFEIT_GOALS : 0;
    // 둘 다 없으면 홈 쪽이 이긴 것으로 친다(토너먼트를 이어가야 한다).
    if (!home && !away) hg = FORFEIT_GOALS;
  }
  const winner =
    hg > ag || (pens && pens.home > pens.away)
      ? m.homeTeamId
      : ag > hg || (pens && pens.away > pens.home)
        ? m.awayTeamId
        : null;
  const stmts: D1PreparedStatement[] = [
    d1
      .prepare(
        `UPDATE cup_matches SET played_at = ?, home_goals = ?, away_goals = ?, pens_home = ?, pens_away = ?,
           winner_team_id = ?, forfeit = ?, detail_json = ? WHERE id = ? AND played_at IS NULL`,
      )
      .bind(now, hg, ag, pens?.home ?? null, pens?.away ?? null, winner, forfeit, detail, m.id),
  ];
  const round = cupKo(m.round as CupRound);
  const name = (id: string | null) => (id ? (entries.get(id)?.name ?? '-') : '-');
  // 본문은 팀 이름과 숫자뿐이라 언어마다 같다(승부차기는 PK).
  const score = `${name(m.homeTeamId)} ${hg} : ${ag} ${name(m.awayTeamId)}${pens ? ` (PK ${pens.home}:${pens.away})` : ''}`;
  for (const id of ids) {
    const e = entries.get(id);
    if (!e) continue;
    const result = cupKo(winner === null ? 'draw' : winner === id ? 'win' : 'loss');
    stmts.push(
      ...notify(
        d1,
        e.profileId,
        `cup-match:${m.id}:${id}`,
        cupKo('matchTitle', { round, result }),
        score,
        now,
      ),
    );
  }
  await d1.batch(stmts);
}

/** 한 라운드가 다 끝났으면 다음 단계(진출·탈락·보상·다음 라운드)를 만든다. */
export async function advanceRound(
  db: Db,
  cup: CupDef,
  state: CupStateRow,
  round: CupRound,
  entries: readonly CupEntryRow[],
  matches: readonly CupMatchRow[],
  now: string,
) {
  const d1 = db.$client;
  const stmts: D1PreparedStatement[] = [];
  const entry = new Map(entries.map((e) => [e.teamId, e]));
  if (round === 'g3') {
    const firsts: string[] = [];
    const seconds: string[] = [];
    for (let g = 1; g <= state.groups; g++) {
      const table = groupTable(entries, matches, state.seed, g);
      firsts.push(table[0]!.teamId);
      seconds.push(table[1]!.teamId);
      for (const s of table.slice(2)) {
        const e = entry.get(s.teamId);
        if (e) stmts.push(...rewardStatements(d1, cup, e, 'group', now));
      }
    }
    const first = firstKoRound(state.groups);
    firstKoPairs(firsts, seconds).forEach(([h, a], slot) =>
      stmts.push(insertMatch(d1, cup, first, 0, slot, h, a)),
    );
  } else {
    const done = matches.filter((m) => m.round === round);
    for (const m of done) {
      const loser = m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
      const le = loser ? entry.get(loser) : undefined;
      if (le) stmts.push(...rewardStatements(d1, cup, le, koLoserStage(round), now));
    }
    if (round === 'f') {
      const champ = done[0]?.winnerTeamId;
      const ce = champ ? entry.get(champ) : undefined;
      if (ce) stmts.push(...rewardStatements(d1, cup, ce, 'champion', now));
      stmts.push(
        d1
          .prepare(`UPDATE cup_state SET done_at = ? WHERE cup_id = ? AND done_at IS NULL`)
          .bind(now, cup.id),
      );
    } else {
      const next = CUP_KO_ROUNDS[CUP_KO_ROUNDS.indexOf(round) + 1]!;
      const sorted = [...done].sort((a, b) => a.slot - b.slot);
      for (let i = 0; i < sorted.length; i += 2)
        stmts.push(
          insertMatch(
            d1,
            cup,
            next,
            0,
            nextKoSlot(sorted[i]!.slot),
            sorted[i]!.winnerTeamId,
            sorted[i + 1]?.winnerTeamId ?? null,
          ),
        );
    }
  }
  if (stmts.length) await d1.batch(stmts);
}

/** cron 한 번: 대회마다 추첨 → 시각이 된 경기 → 끝난 라운드 정리. */
export async function runCup(db: Db, now: string, cups?: readonly CupDef[]) {
  const log: Record<string, unknown>[] = [];
  for (const cup of cups ?? (await cupSchedule(db))) {
    if (now < cup.drawAt) continue;
    let [state] = await cupStateOf(db, cup.id);
    if (!state) {
      log.push({ cup: cup.id, step: 'draw', ...(await drawCup(db, cup, now)) });
      [state] = await cupStateOf(db, cup.id);
    }
    if (!state || state.doneAt) continue;
    // 시각이 된 라운드를 앞에서부터 하나씩: 경기를 치르고, 다 끝났으면 다음 라운드를 만든다.
    for (;;) {
      const [entries, matches] = await Promise.all([
        cupEntriesOf(db, cup.id),
        cupMatchesOf(db, cup.id),
      ]);
      const due = matches
        .filter((m) => !m.playedAt && m.at <= now)
        .sort((a, b) => roundIdx(a.round) - roundIdx(b.round) || a.grp - b.grp || a.slot - b.slot);
      const entryMap = new Map(entries.map((e) => [e.teamId, e]));
      if (due.length) {
        const round = due[0]!.round;
        for (const m of due.filter((x) => x.round === round))
          await playCupMatch(db, cup, m, entryMap, now);
        log.push({
          cup: cup.id,
          step: 'play',
          round,
          n: due.filter((x) => x.round === round).length,
        });
        continue;
      }
      // 경기가 모두 끝난 가장 늦은 라운드 다음 단계가 아직 없으면 만든다.
      const rounds = [...new Set(matches.map((m) => m.round))].sort(
        (a, b) => roundIdx(a) - roundIdx(b),
      );
      const last = rounds.at(-1) as CupRound | undefined;
      if (!last || matches.some((m) => m.round === last && !m.playedAt)) break;
      if (CUP_GROUP_ROUNDS.includes(last) && last !== 'g3') {
        // 조 2팀만 있는 대회는 g2·g3 경기가 없다 — 그래도 g3가 끝난 것으로 보고 넘어간다.
        if (now < roundAt(cup, 'g3')) break;
      }
      const round: CupRound = CUP_GROUP_ROUNDS.includes(last) ? 'g3' : last;
      await advanceRound(db, cup, state, round, entries, matches, now);
      log.push({ cup: cup.id, step: 'advance', round });
      const [after] = await cupStateOf(db, cup.id);
      const again = await cupMatchesOf(db, cup.id);
      if (after?.doneAt || again.length === matches.length) break;
    }
  }
  return log.length ? log : null;
}

/** 활동 중인 내 참가(탈락 전). 시장 잠금·명단 잠금이 쓴다. */
export const activeEntriesOf = (db: Db, profileId: string) =>
  db
    .select()
    .from(cupEntries)
    .where(and(eq(cupEntries.profileId, profileId), eq(cupEntries.status, 'active')));

/** T-11-145 구단주의 컵 성적(보상까지 끝난 것, 최근 대회부터). 팀 프로필 트로피·칭호. */
export async function cupHonorsOf(db: Db, profileId: string) {
  const rows = await db
    .select()
    .from(cupEntries)
    .where(and(eq(cupEntries.profileId, profileId), isNotNull(cupEntries.rewardedAt)));
  if (!rows.length) return [];
  const all = await cupSchedule(db);
  return rows
    .map((e) => ({ e, cup: cupById(e.cupId, all) }))
    .filter((x): x is { e: CupEntryRow; cup: CupDef } => !!x.cup && !!x.e.stage)
    .sort((a, b) => b.cup.opensAt.localeCompare(a.cup.opensAt))
    .map(({ e, cup }) => ({
      cupId: cup.id,
      season: cup.season,
      edition: cup.edition,
      stage: e.stage as CupStage,
      teamName: e.name,
    }));
}
