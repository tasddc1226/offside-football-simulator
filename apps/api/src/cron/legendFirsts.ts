import { LEGEND_THRESHOLDS } from '../firsts.js';

const PREFIX = 'legend_repair:';
const INDEX = 'careers_hof_season_score_order_idx';

/** Use equality on the index's season column even for legacy NULL preseason entries. */
function seasonBranches(season: number, query: (seasonFilter: string) => string): string {
  const branches = [query('service_season = ?1')];
  if (season === 0) branches.push(query('service_season IS NULL'));
  return branches.join(' UNION ALL ');
}

/** Repair at most one affected season. Candidate reads, both ledgers and acknowledgement
 * commit together. A later departure schedules another repair; a failed batch leaves it pending. */
export async function repairNextLegendSeason(db: D1Database): Promise<void> {
  const key = await db
    .prepare(
      "SELECT key FROM app_meta WHERE key >= 'legend_repair:' AND key < 'legend_repair;' ORDER BY value,key LIMIT 1",
    )
    .first<string>('key');
  if (!key) return;
  const season = Number(key.slice(PREFIX.length));
  const visible = "status = 'retired' AND hidden = 0 AND retired_at IS NOT NULL";
  const top = seasonBranches(
    season,
    (filter) => `SELECT * FROM (
    SELECT id, legend_score, retired_at FROM careers INDEXED BY ${INDEX}
    WHERE ${visible} AND ${filter} AND legend_score > 0
    ORDER BY legend_score DESC, retired_at, id LIMIT 1)`,
  );
  // Disjoint score bands visit qualifying entries once. The second comparison searches
  // only the (at most 40 per season encoding) earliest winners of those bands.
  const bandWinners = seasonBranches(
    season,
    (filter) => `SELECT floor, (
    SELECT id FROM careers INDEXED BY ${INDEX} WHERE ${visible} AND ${filter}
      AND legend_score >= floor AND legend_score < ceiling
    ORDER BY retired_at, id LIMIT 1) AS id FROM bands`,
  );
  await db.batch([
    db.prepare("DELETE FROM server_records WHERE season = ? AND id = 'legend'").bind(season),
    db
      .prepare(
        `INSERT INTO server_records (season,id,career_id,value,achieved_at)
      SELECT ?1, 'legend', id, legend_score, retired_at FROM (${top})
      ORDER BY legend_score DESC, retired_at, id LIMIT 1`,
      )
      .bind(season),
    db
      .prepare("DELETE FROM server_firsts WHERE season = ? AND id GLOB 'legend[0-9]*'")
      .bind(season),
    db
      .prepare(
        `WITH bands AS MATERIALIZED (
        SELECT value AS floor, lead(value,1,1e30) OVER (ORDER BY value) AS ceiling FROM json_each(?2)
      ), candidates AS MATERIALIZED (${bandWinners}),
      winners AS MATERIALIZED (
        SELECT candidates.floor, c.id, c.retired_at FROM candidates JOIN careers c ON c.id = candidates.id
      )
      INSERT INTO server_firsts (season,id,career_id,achieved_at)
      SELECT ?1, 'legend' || b.floor, w.id, w.retired_at FROM bands b
      JOIN winners w ON w.id = (
        SELECT id FROM winners WHERE floor >= b.floor ORDER BY retired_at,id LIMIT 1)
      `,
      )
      .bind(season, JSON.stringify(LEGEND_THRESHOLDS)),
    db.prepare('DELETE FROM app_meta WHERE key = ?').bind(key),
  ]);
}
