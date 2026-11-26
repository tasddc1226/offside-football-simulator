/**
 * T-11-829 옛 시즌 행의 대회별 기록(comps_json)·커리어 하이(ch_json)를 비우는 한 번짜리 정리.
 * 두 열은 저장만 되고 어디서도 읽지 않았다(11-25 기준 career_seasons 2.7GB 중 comps_json 785MB). 새 업로드는 더 쓰지 않는다.
 *
 * rowid 구간으로 조금씩 비우고 app_meta에 위치를 적는다. 끝(처음 실행 때의 max(rowid))까지 가면 done으로 남아 그 뒤로는 읽기 한 번뿐이다.
 * 구간 조건만 쓰므로 표 전체를 훑지 않고, 두 열에는 인덱스가 없어 인덱스 쓰기도 없다. 같은 구간을 다시 돌려도 결과는 같다.
 * 비운 자리는 D1 파일 안의 빈 페이지로 남아 이후 쓰기가 다시 쓴다(파일 크기는 바로 줄지 않는다).
 */
export const SEASON_COMPS_TRIM_KEY = 'cron:season-comps:trim';
export const COMPS_TRIM = {
  /** 한 문장에 볼 rowid 구간 폭. */
  chunk: 2_000,
  /** 한 번(5분 cron 한 번)에 돌릴 최대 구간 수와 시간. */
  perStep: 15,
  stepMs: 15_000,
  /** 하루에 볼 최대 rowid 수(쓰기 비용을 며칠에 나눈다). */
  perDay: 400_000,
} as const;

export type SeasonCompsTrim = { cursor: number; end: number; cleared: number; done: boolean };
export type SeasonCompsTrimStep = SeasonCompsTrim & { today: number; doneToday: boolean };

export async function trimSeasonComps(
  db: D1Database,
  prior?: SeasonCompsTrimStep,
  now: () => number = Date.now,
): Promise<SeasonCompsTrimStep> {
  const saved = await db
    .prepare('SELECT value FROM app_meta WHERE key=?1')
    .bind(SEASON_COMPS_TRIM_KEY)
    .first<{ value: string }>();
  let today = prior?.today ?? 0;
  if (saved && (JSON.parse(saved.value) as SeasonCompsTrim).done)
    return { ...(JSON.parse(saved.value) as SeasonCompsTrim), today, doneToday: true };
  let state: SeasonCompsTrim;
  if (saved) state = JSON.parse(saved.value) as SeasonCompsTrim;
  else {
    const top = await db
      .prepare('SELECT max(rowid) AS m FROM career_seasons')
      .first<{ m: number | null }>();
    state = { cursor: 0, end: top?.m ?? 0, cleared: 0, done: false };
  }
  const stmt = db.prepare(
    `UPDATE career_seasons SET comps_json = NULL, ch_json = NULL
     WHERE rowid > ?1 AND rowid <= ?2 AND (comps_json IS NOT NULL OR ch_json IS NOT NULL)`,
  );
  const started = now();
  for (let i = 0; i < COMPS_TRIM.perStep; i++) {
    if (state.cursor >= state.end || today >= COMPS_TRIM.perDay) break;
    if (i > 0 && now() - started > COMPS_TRIM.stepMs) break;
    const to = Math.min(state.cursor + COMPS_TRIM.chunk, state.end);
    const { meta } = await stmt.bind(state.cursor, to).run();
    state.cleared += meta.changes;
    today += to - state.cursor;
    state.cursor = to;
  }
  state.done = state.cursor >= state.end;
  await db
    .prepare(
      'INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .bind(SEASON_COMPS_TRIM_KEY, JSON.stringify(state))
    .run();
  return { ...state, today, doneToday: state.done || today >= COMPS_TRIM.perDay };
}
