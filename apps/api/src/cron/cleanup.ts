// T-10-070 매일 도는 정리(cron). 다시 읽히지 않는 행만 지운다 — 조회 쪽이 이미 만료 행을 걸러 내므로(idempotency·
// sessions의 expiresAt, auth_attempts의 윈도) 지워도 동작은 같고 표만 가벼워진다. 한 번에 많이 지우면 D1 문장
// 시간 한도에 걸리므로 CHUNK씩 나눠 지운다.

import { RATE_LIMIT_WINDOW_MS } from '../db/repos/authAttempts.js';

const CHUNK = 5000;
/** 한 번의 cron에서 표마다 지울 최대 묶음 수 — 남은 건 다음 날 이어서 지운다. */
const MAX_CHUNKS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 표마다: 이 열이 (지금 - keepMs)보다 이르면 지운다. 열마다 인덱스가 있어 묶음마다 표 전체를 훑지 않는다
 * (auth_attempts는 (kind, subject)당 한 행이라 작다). */
const TARGETS: readonly { table: string; column: string; keepMs: number }[] = [
  { table: 'idempotency', column: 'expires_at', keepMs: 0 },
  // 윈도(1시간)보다 넉넉히.
  {
    table: 'auth_attempts',
    column: 'window_start',
    keepMs: Math.max(DAY_MS, 2 * RATE_LIMIT_WINDOW_MS),
  },
  // 만료된 세션도 한 달은 둔다(문의가 오면 언제 로그인했는지 볼 수 있게). 폐기된 세션은 만료 뒤에 지워진다.
  { table: 'sessions', column: 'expires_at', keepMs: 30 * DAY_MS },
];

export type CleanupResult = Record<string, number>;

/** 표마다 지운 행 수. */
export async function cleanupExpired(db: D1Database, now: number): Promise<CleanupResult> {
  const out: CleanupResult = {};
  for (const t of TARGETS) {
    const stmt = db
      .prepare(
        `DELETE FROM ${t.table} WHERE rowid IN (SELECT rowid FROM ${t.table} WHERE ${t.column} < ?1 LIMIT ${CHUNK})`,
      )
      .bind(new Date(now - t.keepMs).toISOString());
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
