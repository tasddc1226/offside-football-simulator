import { sql } from 'drizzle-orm';
import { LEAGUE_BASE } from '@offside/contracts/club-names';

/**
 * T-11-467 선수의 가장 오래 뛴 프로 리그 · 클럽(시너지 리그 컬러 · 클럽 동료). career_seasons의 클럽 id(`${리그}-${n}`)로
 * 센다 — 고교 · 대학 · 병역 시즌과 클럽 id가 없는 옛 시즌은 뺀다. 시즌 수가 같으면 최근에 뛴 쪽이다. 프로 시즌이 없으면 ''.
 * 은퇴 때(putRetirement) 한 번 세고, 이 기능 전에 은퇴한 카드는 runMainClubBackfill이 조금씩 채운다.
 */
const AMATEUR = LEAGUE_BASE.filter((l) => l.amateur)
  .map((l) => `'${l.id}'`)
  .join(',');
const LEAGUE_OF = `substr(s.club_id, 1, instr(s.club_id, '-') - 1)`;
const PRO = `s.career_id = careers.id AND s.mil = 0 AND instr(coalesce(s.club_id, ''), '-') > 0 AND ${LEAGUE_OF} NOT IN (${AMATEUR})`;
const MAIN_LEAGUE_SQL = `coalesce((SELECT ${LEAGUE_OF} AS lg FROM career_seasons s WHERE ${PRO} GROUP BY lg ORDER BY count(*) DESC, max(s.year) DESC LIMIT 1), '')`;
const MAIN_CLUB_SQL = `coalesce((SELECT s.club_id FROM career_seasons s WHERE ${PRO} GROUP BY s.club_id ORDER BY count(*) DESC, max(s.year) DESC LIMIT 1), '')`;

/** careers UPDATE의 set 값(drizzle). */
export const mainClubSet = {
  mainLeague: sql.raw(MAIN_LEAGUE_SQL),
  mainClub: sql.raw(MAIN_CLUB_SQL),
};

export const MAIN_CLUB_STATE_KEY = 'cron:main-club:state';
type State = { phase: 'lineups' | 'cards'; cursor: number; done?: boolean };
export type MainClubBackfill = {
  phase: State['phase'];
  rows: number;
  careers: number;
  done: boolean;
};

/**
 * 이 기능 전에 은퇴한 선수의 주 리그 · 클럽을 5분마다 한 조각씩 채운다. 지금 선발에 든 선수(owner_teams)부터, 그다음 모든
 * 카드를 rowid 순으로 훑는다. 다 끝나면 멈춘다. 이미 센 선수(main_league IS NOT NULL)는 건너뛴다.
 */
export async function runMainClubBackfill(
  d1: D1Database,
  teamPage = 200,
  cardPage = 1000,
): Promise<MainClubBackfill | null> {
  const raw = await d1
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(MAIN_CLUB_STATE_KEY)
    .first<{ value: string }>();
  const state: State = raw ? (JSON.parse(raw.value) as State) : { phase: 'lineups', cursor: 0 };
  if (state.done) return null;
  const lineups = state.phase === 'lineups';
  const page = lineups ? teamPage : cardPage;
  const rows = (
    await d1
      .prepare(
        lineups
          ? 'SELECT rowid AS rid, slots_json AS v FROM owner_teams WHERE rowid > ?1 ORDER BY rowid LIMIT ?2'
          : 'SELECT rowid AS rid, career_id AS v FROM cards WHERE rowid > ?1 ORDER BY rowid LIMIT ?2',
      )
      .bind(state.cursor, page)
      .all<{ rid: number; v: string }>()
  ).results;
  const ids = [
    ...new Set(
      lineups
        ? rows.flatMap((r) => (JSON.parse(r.v) as (string | null)[]).filter((id) => !!id))
        : rows.map((r) => r.v),
    ),
  ] as string[];
  if (ids.length)
    await d1
      .prepare(
        `UPDATE careers SET main_league = ${MAIN_LEAGUE_SQL}, main_club = ${MAIN_CLUB_SQL}
        WHERE id IN (SELECT value FROM json_each(?1)) AND main_league IS NULL`,
      )
      .bind(JSON.stringify(ids))
      .run();
  const end = rows.length < page;
  const next: State = end
    ? lineups
      ? { phase: 'cards', cursor: 0 }
      : { ...state, done: true }
    : { ...state, cursor: rows.at(-1)!.rid };
  await d1
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .bind(MAIN_CLUB_STATE_KEY, JSON.stringify(next))
    .run();
  return { phase: state.phase, rows: rows.length, careers: ids.length, done: !!next.done };
}
