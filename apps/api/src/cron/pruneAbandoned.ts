/**
 * T-11-468 버린 커리어 정리. 새 선수를 만들어 몇 시즌만 해 보고 그만둔 커리어가 진행 중 커리어의 대부분이라(대부분 생성 뒤
 * 한 시간 안에 멈춘다) 매일 단계에서 지운다. 커리어와 시즌 행을 지우고 pruned_careers에 주인 · 서비스 시즌만 남긴다.
 * 기기에서 다시 이어 하면 다음 시즌 업로드가 커리어를 새로 만들고 원래 서비스 시즌을 되찾는다(지운 앞 시즌 기록은 돌아오지 않는다).
 *
 * 은퇴 선수는 건드리지 않는다. 칭호 · 명예의 벽 · 카드 · 이적 내역 · 최초 기록 · 서버 기록 · 영구결번 · 구단주 결산의 대표 선수 ·
 * 감독 · 이름 변경 · 상세 기록 보관(careerRetention)에 걸린 커리어도 남긴다. 업적 · 시즌 게이지 · 명예의 전당은 은퇴만 센다.
 */
import { DAY_MS } from '../time.js';

export const PRUNE = {
  /** 마지막 서버 갱신 뒤 이만큼 지나야 지운다. */
  idleDays: 7,
  /** 처음 올라온 때부터 마지막 갱신까지가 이보다 짧은 커리어만(오래 키운 선수는 쉬고 있을 수 있다). */
  maxPlayMs: 60 * 60_000,
  /** 한 batch에 지울 커리어 수(시즌 행까지 한 트랜잭션). */
  page: 200,
  /** 한 번(5분 cron 한 번)에 지울 최대 수와 시간. */
  perStep: 2_000,
  stepMs: 20_000,
  /** 하루 최대(쌓인 분량은 며칠에 나눠 지운다). */
  perDay: 20_000,
} as const;

export type PruneResult = {
  pruned: number;
  raced: number;
  done: boolean;
  /** 오늘 마지막으로 읽은 [갱신 시각, rowid] — 남긴 커리어(보호 · 오래 플레이)를 페이지마다 다시 읽지 않는다. */
  after?: [string, number];
};

/** ?1 = 마지막 갱신 상한, ?2 = 최대 플레이 일수(julianday 차). 보호 조건은 모두 career_id 인덱스로 본다. */
const ELIGIBLE = `c.status = 'active' AND c.updated_at <= ?1
  AND julianday(c.updated_at) - julianday(c.created_at) < ?2
  AND c.detail_archive_key IS NULL AND c.title IS NULL AND c.wall_of_honor_json IS NULL
  AND NOT EXISTS (SELECT 1 FROM cards r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM market_listings r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM server_firsts r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM server_records r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM retired_numbers r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM owner_season_records r WHERE r.best_career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM manager_careers r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM career_renames r WHERE r.career_id = c.id)`;

/** 읽은 뒤 그 사이 시즌이 올라오지 않은(같은 갱신 시각 · 아직 진행 중) 커리어만. ?1 = [{id, u}] JSON. */
const UNCHANGED = `SELECT c.id FROM careers c JOIN json_each(?1) j
  ON c.id = json_extract(j.value, '$.id') AND c.updated_at = json_extract(j.value, '$.u')
  WHERE c.status = 'active'`;

/** 한 페이지: after 뒤 후보를 읽고, 읽은 그대로인 것만 흔적을 남기고 지운다. 지운 수 · 읽은 수 · 마지막 갱신 시각. */
async function prunePage(db: D1Database, cutoff: string, after: [string, number], now: string) {
  // 인덱스(status, updated_at)는 rowid를 끝에 달고 있어 (updated_at, rowid) 순서로 정렬 없이 이어 읽는다.
  const { results } = await db
    .prepare(
      `SELECT c.id, c.updated_at AS u, c.rowid AS r FROM careers c INDEXED BY careers_status_updated_idx
       WHERE ${ELIGIBLE} AND (c.updated_at > ?3 OR (c.updated_at = ?3 AND c.rowid > ?4))
       ORDER BY c.updated_at, c.rowid LIMIT ${PRUNE.page}`,
    )
    .bind(cutoff, PRUNE.maxPlayMs / DAY_MS, after[0], after[1])
    .all<{ id: string; u: string; r: number }>();
  if (!results.length) return { read: 0, pruned: 0, last: after };
  const picked = JSON.stringify(results.map(({ id, u }) => ({ id, u })));
  const [, , gone] = await db.batch([
    db
      .prepare(
        `INSERT INTO pruned_careers (career_id, profile_id, service_season, pruned_at)
         SELECT id, profile_id, service_season, ?2 FROM careers WHERE id IN (${UNCHANGED})
         ON CONFLICT (career_id) DO UPDATE SET profile_id = excluded.profile_id,
           service_season = excluded.service_season, pruned_at = excluded.pruned_at`,
      )
      .bind(picked, now),
    db.prepare(`DELETE FROM career_seasons WHERE career_id IN (${UNCHANGED})`).bind(picked),
    db.prepare(`DELETE FROM careers WHERE id IN (${UNCHANGED})`).bind(picked),
  ]);
  return {
    read: results.length,
    pruned: gone!.meta.changes,
    last: [results.at(-1)!.u, results.at(-1)!.r] as [string, number],
  };
}

/**
 * 매일 단계 한 번: 버린 커리어를 페이지마다 지운다. prior는 오늘 앞선 단계 결과(하루 상한을 이어 센다).
 * 후보가 바닥나거나 하루 상한에 닿으면 done.
 */
export async function pruneAbandonedCareers(
  db: D1Database,
  at: number,
  prior?: PruneResult,
): Promise<PruneResult> {
  const cutoff = new Date(at - PRUNE.idleDays * DAY_MS).toISOString();
  const now = new Date(at).toISOString();
  const wall = Date.now();
  const result: PruneResult = {
    pruned: prior?.pruned ?? 0,
    raced: prior?.raced ?? 0,
    done: false,
    after: prior?.after ?? ['', 0],
  };
  let step = 0;
  while (step < PRUNE.perStep && Date.now() - wall < PRUNE.stepMs) {
    if (result.pruned >= PRUNE.perDay) return { ...result, done: true };
    const page = await prunePage(db, cutoff, result.after!, now);
    result.after = page.last;
    result.pruned += page.pruned;
    result.raced += page.read - page.pruned;
    step += page.read;
    if (page.read < PRUNE.page) return { ...result, done: true };
  }
  return result;
}
