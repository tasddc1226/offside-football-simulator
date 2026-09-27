// T-10-070 매일 도는 정리(cron). 다시 읽히지 않는 행만 지운다 — 조회 쪽이 이미 만료 행을 걸러 내므로(idempotency·
// sessions의 expiresAt, auth_attempts의 윈도) 지워도 동작은 같고 표만 가벼워진다. 한 번에 많이 지우면 D1 문장
// 시간 한도에 걸리므로 CHUNK씩 나눠 지운다.

const CHUNK = 5000;
/** 한 번의 cron에서 표마다 지울 최대 묶음 수 — 남은 건 다음 날 이어서 지운다. */
const MAX_CHUNKS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;
/** auth_attempts 윈도(RATE_LIMIT_WINDOW_MS, 1시간)보다 넉넉히. */
const ATTEMPT_KEEP_MS = DAY_MS;
/** 만료·폐기된 세션도 한 달은 둔다(문의가 오면 언제 로그인했는지 볼 수 있게). */
const SESSION_KEEP_MS = 30 * DAY_MS;

type Target = { table: string; where: string; before: (now: number) => string };

const TARGETS: readonly Target[] = [
  { table: 'idempotency', where: 'expires_at <= ?1', before: (now) => iso(now) },
  {
    table: 'auth_attempts',
    where: 'window_start < ?1',
    before: (now) => iso(now - ATTEMPT_KEEP_MS),
  },
  {
    table: 'sessions',
    where: 'expires_at < ?1 OR revoked_at < ?1',
    before: (now) => iso(now - SESSION_KEEP_MS),
  },
];

const iso = (ms: number) => new Date(ms).toISOString();

export type CleanupResult = Record<string, number>;

/** 표마다 지운 행 수. */
export async function cleanupExpired(db: D1Database, now: number): Promise<CleanupResult> {
  const out: CleanupResult = {};
  for (const t of TARGETS) {
    const stmt = db
      .prepare(
        `DELETE FROM ${t.table} WHERE rowid IN (SELECT rowid FROM ${t.table} WHERE ${t.where} LIMIT ${CHUNK})`,
      )
      .bind(t.before(now));
    let deleted = 0;
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const { meta } = await stmt.run();
      deleted += meta.changes;
      if (meta.changes < CHUNK) break;
    }
    out[t.table] = deleted;
  }
  return out;
}
