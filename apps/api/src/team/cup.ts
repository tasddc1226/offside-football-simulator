import { isTitleStage, TITLE_STAGES, titleIdOf } from '@offside/contracts/owner-title';
import {
  CUP_GROUP_ROUNDS,
  CUP_KO_ROUNDS,
  cupPredictionCap,
  cupReward,
  CUP_ROUNDS,
  CUP_STAGES,
  CUP_DIVISION_MIN,
  CUP_DIVISIONS,
  entrantDivisionCaps,
  cupById,
  cupGroupCount,
  editionCups,
  fitsDivision,
  firstKoRound,
  lockAt,
  pullCupForward,
  roundAt,
  type CupDef,
  type CupRound,
  type CupStage,
} from '@offside/contracts/cup';
import { and, asc, eq, getTableColumns, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { cupEntries, cupMatches, cupState, cups, ownerTeams, profiles } from '../db/schema.js';
import { cupKo, cupTitle } from '../cupText.js';
import { predictionSettlementStatements } from './cupPredictions.js';
import { grantItemStatement } from '../db/repos/itemShop.js';
import { cupSchedule } from './cupSchedule.js';
import { cupResultStatements } from '../push/cupResult.js';
import { eventNotificationStatements } from '../push/events.js';
import { cupAtkKOf } from '../db/repos/balance.js';
import { lineupsOf, matchDetailOf } from './match.js';
import { penaltyShootout, simulateMatch } from './sim.js';
import { CUP_ODDS_PER_TICK, fillCupOdds, oddsOfLineups } from './cupOdds.js';
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
/** A single indexed read across active cups, without match detail JSON or a binding per cup. */
export const cupMatchesIn = (db: Db, ids: readonly string[]) =>
  db
    .select(MATCH_COLS)
    .from(cupMatches)
    .where(inArray(cupMatches.cupId, sql`(select value from json_each(${JSON.stringify(ids)}))`));
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

/**
 * T-11-150 칭호를 받는 성적이면 대표 칭호를 자동으로 바꾼다 — 구단주가 직접 고르지 않았고(title_pinned 0) 새 칭호가 지금
 * 칭호보다 좋거나 같은 단계일 때. owner-title titlesOf 순서(단계, 같으면 최근 회차)와 같다 — 새 대회가 가장 최근 회차다.
 */
function autoTitle(d1: D1Database, cup: CupDef, profileId: string, stage: CupStage) {
  if (!isTitleStage(stage)) return [];
  const t = stage;
  // 지금 칭호가 새 칭호보다 아래거나 같은 단계면 바꾼다(우승은 늘, 준우승은 준우승·4강 위로, 4강은 4강 위로).
  const below = TITLE_STAGES.slice(TITLE_STAGES.indexOf(t));
  return [
    d1
      .prepare(
        `UPDATE profiles SET title = ? WHERE id = ? AND title_pinned = 0
         AND (title IS NULL OR ${below.map(() => 'title LIKE ?').join(' OR ')})`,
      )
      .bind(titleIdOf(cup.edition, t, cup.division), profileId, ...below.map((b) => `%-${b}`)),
  ];
}

function rewardStatements(
  d1: D1Database,
  cup: CupDef,
  e: Pick<CupEntryRow, 'teamId' | 'profileId'>,
  stage: CupStage,
  now: string,
) {
  const status = stage === 'champion' ? 'champion' : 'out';
  const { rerolls: n, scouts, boosts } = cupReward(cup.edition, stage);
  const granted = {
    sql: 'EXISTS (SELECT 1 FROM cup_entries WHERE cup_id = ? AND team_id = ? AND rewarded_at = ?)',
    params: [cup.id, e.teamId, now],
  };
  return [
    d1
      .prepare(
        `UPDATE cup_entries SET stage = ?, status = ?, rewarded_at = ?, updated_at = ?
         WHERE cup_id = ? AND team_id = ? AND rewarded_at IS NULL`,
      )
      .bind(stage, status, now, now, cup.id, e.teamId),
    grantItemStatement(d1, e.profileId, 'reroll', n, now, {
      sql: 'changes() = 1',
    }),
    // T-11-244·249 프리미엄 스카우트권·잠재력 강화권(제2회부터). 바로 앞 문장이 리롤권이라 보상 줄로 거른다.
    ...(scouts > 0 ? [grantItemStatement(d1, e.profileId, 'scout', scouts, now, granted)] : []),
    ...(boosts > 0 ? [grantItemStatement(d1, e.profileId, 'boost', boosts, now, granted)] : []),
    ...autoTitle(d1, cup, e.profileId, stage),
    // 개인 성적·보상은 알림함에 남긴다. 대회 종료 때 참가·예측을 합쳐 종료 푸시 한 건을 보낸다.
    ...notify(
      d1,
      e.profileId,
      `cup:${cup.id}:result`,
      cupKo(stage === 'champion' ? 'championTitle' : 'outTitle', { cup: cupTitle(cup) }),
      boosts > 0
        ? cupKo('rewardBodyBoost', { stage: cupKo(stage), n, s: scouts, b: boosts })
        : scouts > 0
          ? cupKo('rewardBodyScout', { stage: cupKo(stage), n, s: scouts })
          : cupKo('rewardBody', { stage: cupKo(stage), n }),
      now,
      false,
    ),
  ];
}

// 탭하면 홈(컵 배너)으로 간다. 앱 알림 target에 'cup'이 없어 구버전 앱도 읽는 'home'을 쓴다.
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
      content: { kind: 'team', title, body, target: { type: 'screen', screen: 'home' } },
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
  // T-11-410 구간 대회는 같은 회차 구간끼리 일정이 같아야 해서 당기지 않는다.
  if (cup.division) return null;
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

/**
 * T-11-410 구간 대회 추첨 전 회차 정리(한 번). 1) T-11-552 신청한 팀들의 지금 팀 OVR 1/3 · 2/3 지점으로 아랫 구간 상한을
 * 다시 정하고(접수 때 상한은 신청하지 않은 팀까지 센 시즌 팀 기준이라 센 팀이 마스터로 몰렸다), 모든 팀을 들어갈 수 있는
 * 가장 낮은 구간으로 옮긴다(신청한 구간은 희망으로만 본다). 2) CUP_DIVISION_MIN팀보다 적은 구간은 바로 윗 구간으로,
 * 3) 마스터가 모자라면 바로 아랫 구간을 마스터로 옮긴다. 옮긴 팀에는 알림 1건. 한 번 했으면 app_meta 표시로 건너뛴다.
 */
export async function settleDivisions(db: Db, siblings: readonly CupDef[], now: string) {
  const d1 = db.$client;
  const head = siblings.at(-1)!;
  const key = `cup-settle:${head.id}`;
  if (await d1.prepare('SELECT 1 FROM app_meta WHERE key = ?').bind(key).first()) return null;
  const ids = siblings.map((c) => c.id);
  const { results } = await d1
    .prepare(
      `SELECT e.cup_id AS cupId, e.team_id AS teamId, e.profile_id AS profileId, t.ovr AS ovr
       FROM cup_entries e LEFT JOIN owner_teams t ON t.id = e.team_id
       WHERE e.cup_id IN (${ids.map(() => '?').join(', ')}) AND e.status = 'active'`,
    )
    .bind(...ids)
    .all<{ cupId: string; teamId: string; profileId: string; ovr: number | null }>();
  const rows = results.map((r) => ({
    ...r,
    at: ids.indexOf(r.cupId),
    why: '' as '' | 'up' | 'sorted' | 'merged',
  }));
  const caps = entrantDivisionCaps(rows.flatMap((r) => (r.ovr === null ? [] : [r.ovr])));
  const capped: D1PreparedStatement[] = [];
  siblings.forEach((c, i) => {
    if (!caps || !c.division || c.division === 'master') return;
    const cap = caps[CUP_DIVISIONS.indexOf(c.division)]!;
    if (cap === c.ovrMax) return;
    capped.push(d1.prepare('UPDATE cups SET ovr_max = ? WHERE id = ?').bind(cap, ids[i]!));
    // 같은 cron이 이어서 추첨할 때 새 상한을 쓰게 한다.
    c.ovrMax = cap;
  });
  for (const r of rows) {
    // 신청이 적어 상한을 다시 정하지 않았으면 예전처럼 상한을 넘는 팀만 위로 옮긴다.
    if (r.ovr === null || (!caps && fitsDivision(siblings[r.at]!, r.ovr))) continue;
    const fit = siblings.findIndex((c) => fitsDivision(c, r.ovr!));
    const to = fit < 0 ? siblings.length - 1 : fit;
    if (to === r.at) continue;
    r.at = to;
    r.why = caps ? 'sorted' : 'up';
  }
  const count = (i: number) => rows.filter((r) => r.at === i).length;
  const merge = (from: number, to: number) => {
    for (const r of rows.filter((x) => x.at === from)) {
      r.at = to;
      r.why ||= 'merged';
    }
  };
  const last = siblings.length - 1;
  for (let i = 0; i < last; i++) if (count(i) > 0 && count(i) < CUP_DIVISION_MIN) merge(i, i + 1);
  for (let i = last - 1; i >= 0 && count(last) > 0 && count(last) < CUP_DIVISION_MIN; i--)
    if (count(i) > 0) merge(i, last);
  const stmts: D1PreparedStatement[] = [
    d1.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)').bind(key, now),
    ...capped,
  ];
  const moved = rows.filter((r) => ids[r.at] !== r.cupId);
  // T-11-527 아랫 구간(주니어)은 자격이 낮다. 옮겨 간 팀이 추첨에서 떨어지지 않게 받는 대회 자격을 그 팀이 신청한 구간
  // 자격까지 낮춘다(접수가 끝난 뒤라 새 신청은 없고, 받는 대회의 명단 저장 판정도 같이 느슨해진다).
  const lowered = new Map<number, number>();
  for (const r of moved) {
    const from = siblings[ids.indexOf(r.cupId)]!.minFilled;
    if (from < Math.min(siblings[r.at]!.minFilled, lowered.get(r.at) ?? Infinity))
      lowered.set(r.at, from);
  }
  for (const [at, minFilled] of lowered) {
    stmts.push(
      d1
        .prepare('UPDATE cups SET min_filled = ? WHERE id = ? AND min_filled > ?')
        .bind(minFilled, ids[at]!, minFilled),
    );
    // 같은 cron이 이어서 추첨할 때 낮춘 자격을 쓰게 한다.
    siblings[at]!.minFilled = minFilled;
  }
  for (const r of moved) {
    const to = siblings[r.at]!;
    stmts.push(
      // 같은 회차 다른 구간에 예전에 취소한 행이 있으면 그 행을 덮는다.
      d1
        .prepare(
          `UPDATE OR REPLACE cup_entries SET cup_id = ?, updated_at = ? WHERE cup_id = ? AND team_id = ?`,
        )
        .bind(to.id, now, r.cupId, r.teamId),
      ...notify(
        d1,
        r.profileId,
        `cup:${to.id}:moved`,
        cupKo('movedTitle', { cup: cupTitle(to) }),
        r.why === 'sorted'
          ? cupKo('sortedBody', { ovr: r.ovr ?? 0 })
          : r.why === 'up'
            ? cupKo('movedUpBody')
            : cupKo('mergedBody', { n: CUP_DIVISION_MIN }),
        now,
      ),
    );
  }
  await d1.batch(stmts);
  return { moved: moved.length };
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
        // T-11-246 128팀은 D1 바인드 변수 상한(100)을 넘으므로 id 목록 대신 참가 표와 잇는다.
        .innerJoin(
          cupEntries,
          and(
            eq(cupEntries.teamId, ownerTeams.id),
            eq(cupEntries.cupId, cup.id),
            eq(cupEntries.status, 'active'),
          ),
        )
    : [];
  const byId = new Map(teams.map((t) => [t.team.id, t.team]));
  const ok = entries.filter((e) => {
    const t = byId.get(e.teamId);
    return t && t.season === cup.season && t.filled >= cup.minFilled;
  });
  const dropped = entries.filter((e) => !ok.includes(e));
  const groups = cupGroupCount(ok.length, cup.capacity);
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

/**
 * 경기 한 판을 치르고 적는다. 팀이 없거나(지워짐·다른 시즌) 선수가 없으면 0:3 몰수. atkK는 밸런스 설정 컵 공격 계수(T-11-409,
 * 주지 않으면 여기서 읽는다).
 */
export async function playCupMatch(
  db: Db,
  cup: CupDef,
  m: CupMatchRow,
  entries: ReadonlyMap<string, CupEntryRow>,
  now: string,
  atkK?: number,
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
  // T-11-407 cron이 늦어 잠금 뒤 예상을 아직 못 채웠으면 같은 명단으로 여기서 채운다(끝난 경기에도 경기 전 예상이 남는다).
  let odds: string | null = null;
  if (home && away) {
    const [lineups, k] = await Promise.all([
      lineupsOf(db, cup.season, home, away),
      atkK ?? cupAtkKOf(db),
    ]);
    if (!m.oddsJson) odds = JSON.stringify(oddsOfLineups(lineups, cup.season, k));
    const result = simulateMatch(m.id, lineups.home, lineups.away, cup.season, {
      neutral: true,
      coaches: lineups.coaches,
      atkK: k,
    });
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
           winner_team_id = ?, forfeit = ?, detail_json = ?, odds_json = COALESCE(odds_json, ?)
         WHERE id = ? AND played_at IS NULL`,
      )
      .bind(
        now,
        hg,
        ag,
        pens?.home ?? null,
        pens?.away ?? null,
        winner,
        forfeit,
        detail,
        odds,
        m.id,
      ),
  ];
  const round = cupKo(m.round as CupRound);
  // T-11-228 알림도 이 경기를 치른 지금 팀 이름으로(팀이 없으면 신청 때 이름).
  const name = (id: string | null) => (id ? (team(id)?.name ?? entries.get(id)?.name ?? '-') : '-');
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
        m.round !== 'f',
      ),
    );
  }
  stmts.push(...predictionSettlementStatements(d1, m.id, now, cupPredictionCap(cup.edition)));
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
        ...cupResultStatements(d1, cup, now),
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

/**
 * cron 한 번에 치르는 경기 수 상한(모든 대회 합). 128팀 조별 라운드(64경기)는 cron 2번(5분)에 나눠 치른다. T-11-410 구간
 * 대회가 함께 돌아도 이 예산을 나눠 쓰고, 라운드 만들기(보상 · 다음 대진)도 cron마다 하나만 한다 — D1 호출당 쿼리
 * 상한(1000) 안에 둔다.
 */
export const CUP_MATCHES_PER_TICK = 32;

/** cron 한 번: 대회마다 추첨 → 시각이 된 경기 → 끝난 라운드 정리. */
export async function runCup(db: Db, now: string, cups?: readonly CupDef[]) {
  const log: Record<string, unknown>[] = [];
  const all = cups ?? (await cupSchedule(db));
  let budget = CUP_MATCHES_PER_TICK;
  let oddsBudget = CUP_ODDS_PER_TICK;
  let advanced = false;
  const settled = new Set<string>();
  // T-11-409 컵 공격 계수는 경기 · 예상을 계산할 때만, cron 한 번에 한 번 읽는다.
  let atkK: Promise<number> | undefined;
  const atkKOf = () => (atkK ??= cupAtkKOf(db));
  for (const cup of all) {
    if (now < cup.drawAt) continue;
    if (cup.division) {
      const siblings = editionCups(cup, all);
      const head = siblings.at(-1)!.id;
      if (!settled.has(head)) {
        settled.add(head);
        const r = await settleDivisions(db, siblings, now);
        if (r) log.push({ cup: head, step: 'settle', ...r });
      }
    }
    let [state] = await cupStateOf(db, cup.id);
    if (!state) {
      log.push({ cup: cup.id, step: 'draw', ...(await drawCup(db, cup, now)) });
      [state] = await cupStateOf(db, cup.id);
    }
    if (!state || state.doneAt) continue;
    // 시각이 된 라운드를 앞에서부터 하나씩: 경기를 치르고, 다 끝났으면 다음 라운드를 만든다.
    let oddsChecked = false;
    for (;;) {
      const [entries, matches] = await Promise.all([
        cupEntriesOf(db, cup.id),
        cupMatchesOf(db, cup.id),
      ]);
      // T-11-407 명단이 잠긴 경기의 예상을 cron마다 한 번 채운다(이미 읽은 경기 목록으로, 남은 건 다음 cron이).
      if (!oddsChecked && oddsBudget > 0) {
        oddsChecked = true;
        const n = await fillCupOdds(db, cup, matches, now, atkKOf, oddsBudget);
        oddsBudget -= n;
        if (n) log.push({ cup: cup.id, step: 'odds', n });
      }
      const due = matches
        .filter((m) => !m.playedAt && m.at <= now)
        .sort((a, b) => roundIdx(a.round) - roundIdx(b.round) || a.grp - b.grp || a.slot - b.slot);
      const entryMap = new Map(entries.map((e) => [e.teamId, e]));
      if (due.length) {
        if (budget <= 0) break;
        const round = due[0]!.round;
        // 한 라운드가 CUP_MATCHES_PER_TICK경기를 넘으면 나머지는 다음 cron(5분 뒤)이 이어서 치른다. 명단 잠금·승부예측
        // 마감은 경기 시각(at) 기준이라 늦게 치른 경기도 같은 조건이다.
        const batch = due.filter((x) => x.round === round).slice(0, budget);
        budget -= batch.length;
        for (const m of batch) await playCupMatch(db, cup, m, entryMap, now, await atkKOf());
        log.push({ cup: cup.id, step: 'play', round, n: batch.length });
        // T-11-246 128팀이면 조별 3차전(64경기)과 64강 만들기·조별 탈락 보상을 한 번에 하면 D1 쿼리 상한(호출당 1000)에
        // 가깝다. cron 한 번에 라운드 하나만 치르고, 다음 라운드 만들기·보상은 다음 cron(5분 뒤)이 한다.
        break;
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
      if (advanced) break;
      advanced = true;
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

/**
 * T-11-552 구단주가 참가 중인(탈락 전) 컵의 시즌들. 시즌이 넘어간 뒤에도 끝나지 않은 지난 시즌 컵(시즌 1 제3회)의 팀은
 * 컵 명단으로 고치고 선발을 지킨다. 참가 표 인덱스로 한 번 읽는다.
 */
export const activeCupSeasonsQuery = (db: Db, profileId: string) =>
  db
    .selectDistinct({ season: cups.season })
    .from(cupEntries)
    .innerJoin(cups, eq(cups.id, cupEntries.cupId))
    .where(and(eq(cupEntries.profileId, profileId), eq(cupEntries.status, 'active')));

/** T-11-145 구단주의 컵 성적(보상까지 끝난 것, 최근 대회부터). 팀 프로필 트로피·칭호, 받침대에 새길 닉네임. */
/** T-11-237 그 팀의 오프사이드 컵 최고 성적(보상까지 끝난 컵만, 업적 판정용). 없으면 null. */
export async function cupBestOf(
  db: Db,
  profileId: string,
  teamId: string,
): Promise<CupStage | null> {
  // 구단주 인덱스(cup_entries_profile_idx)로 찾는다 — 한 구단주의 컵 참가는 몇 줄뿐이다.
  const rows = await db
    .select({ stage: cupEntries.stage })
    .from(cupEntries)
    .where(
      and(
        eq(cupEntries.profileId, profileId),
        eq(cupEntries.teamId, teamId),
        isNotNull(cupEntries.rewardedAt),
      ),
    );
  const stages = rows.flatMap((r) => (r.stage ? [r.stage as CupStage] : []));
  return CUP_STAGES.find((st) => stages.includes(st)) ?? null;
}

export async function cupHonorsOf(db: Db, profileId: string) {
  const rows = await db
    .select()
    .from(cupEntries)
    .where(and(eq(cupEntries.profileId, profileId), isNotNull(cupEntries.rewardedAt)));
  if (!rows.length) return [];
  const [all, [who]] = await Promise.all([
    cupSchedule(db),
    db.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.id, profileId)),
  ]);
  const owner = who?.nickname ?? null;
  return rows
    .map((e) => ({ e, cup: cupById(e.cupId, all) }))
    .filter((x): x is { e: CupEntryRow; cup: CupDef } => !!x.cup && !!x.e.stage)
    .sort((a, b) => b.cup.opensAt.localeCompare(a.cup.opensAt))
    .map(({ e, cup }) => ({
      cupId: cup.id,
      season: cup.season,
      edition: cup.edition,
      ...(cup.division ? { division: cup.division } : {}),
      stage: e.stage as CupStage,
      teamName: e.name,
      owner,
    }));
}
