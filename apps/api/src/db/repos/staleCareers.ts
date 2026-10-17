/**
 * T-11-354 이어 하지 않은 진행 중 커리어 정리. 새 선수로 다시 시작하면 지난 커리어는 서버에 진행 중(active)으로 남는다.
 * 주인이 고르면 `abandoned_at`만 채운다. 행·시즌 기록은 지우지 않고 공개 기록·순위·은퇴 기록에는 닿지 않는다
 * (그쪽은 모두 은퇴 커리어만 읽는다). 같은 커리어의 시즌·은퇴가 다시 올라오면 putCareerSeason·putRetirement가 비운다.
 */
import { STALE_CAREER_CLEAR_MAX, STALE_CAREER_COUNT_MAX } from '@offside/contracts';
import { and, count, eq, inArray, isNull, lt, notInArray, type SQL } from 'drizzle-orm';
import { careers } from '../schema.js';
import type { Db } from '../client.js';

/** 정리 대상: 내 커리어 · 진행 중 · 아직 정리 안 함 · cutoff 전부터 올라오지 않음 · keep에 없음. 인덱스 careers_profile_abandoned_idx. */
function staleWhere(profileId: string, cutoff: string, keep: readonly string[]): SQL {
  return and(
    eq(careers.profileId, profileId),
    eq(careers.status, 'active'),
    isNull(careers.abandonedAt),
    lt(careers.updatedAt, cutoff),
    ...(keep.length ? [notInArray(careers.id, [...keep])] : []),
  )!;
}

/** 상한(STALE_CAREER_COUNT_MAX)까지만 센다. */
const countQuery = (db: Db, where: SQL) => {
  const capped = db
    .select({ id: careers.id })
    .from(careers)
    .where(where)
    .limit(STALE_CAREER_COUNT_MAX)
    .as('capped');
  return db.select({ n: count() }).from(capped);
};

export async function countStaleCareers(
  db: Db,
  profileId: string,
  cutoff: string,
  keep: readonly string[],
): Promise<number> {
  const [row] = await countQuery(db, staleWhere(profileId, cutoff, keep));
  return Number(row?.n ?? 0);
}

/**
 * 한 번에 STALE_CAREER_CLEAR_MAX개까지 정리하고, 같은 트랜잭션에서 남은 수를 센다. 이미 정리한 행은 조건에서 빠지므로
 * 다시 불러도 같은 행을 두 번 세지 않는다(멱등). updated_at은 건드리지 않는다(보관 작업·홈 현황이 그 값을 쓴다).
 */
export async function clearStaleCareers(
  db: Db,
  profileId: string,
  cutoff: string,
  keep: readonly string[],
  now: string,
): Promise<{ cleared: number; remaining: number }> {
  const where = staleWhere(profileId, cutoff, keep);
  const picked = db
    .select({ id: careers.id })
    .from(careers)
    .where(where)
    .limit(STALE_CAREER_CLEAR_MAX);
  const [updated, [left]] = await db.batch([
    db
      .update(careers)
      .set({ abandonedAt: now })
      .where(and(inArray(careers.id, picked), where))
      .returning({ id: careers.id }),
    countQuery(db, where),
  ]);
  return { cleared: updated.length, remaining: Number(left?.n ?? 0) };
}
