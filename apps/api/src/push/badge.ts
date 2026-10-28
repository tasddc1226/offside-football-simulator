// T-11-547 앱 아이콘 뱃지. 앱이 꺼져 있으면 아이콘 숫자는 푸시의 badge(iOS aps.badge)만 바꿀 수 있어서,
// 보낼 때 받는 사람의 안 읽은 알림 수를 같이 싣는다. 알림함 목록의 unreadCount와 같은 조건으로 센다.
const CHUNK = 90; // D1 바인딩 100개 상한 안에서 profile_id를 나눠 센다.

export async function unreadBadges(db: D1Database, profileIds: string[], now: string) {
  const ids = [...new Set(profileIds)];
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  try {
    const results = await db.batch(
      chunks.map((chunk) =>
        db
          .prepare(
            `SELECT profile_id, COUNT(*) AS count FROM notifications
    WHERE profile_id IN (${chunk.map(() => '?').join(',')}) AND read_at IS NULL AND expires_at > ?
    GROUP BY profile_id`,
          )
          .bind(...chunk, now),
      ),
    );
    for (const r of results)
      for (const row of r.results as { profile_id: string; count: number }[])
        counts.set(row.profile_id, row.count);
  } catch {
    // 뱃지는 덤이다. 세지 못하면 badge 없이 보낸다(아이콘 숫자를 그대로 둔다).
    return null;
  }
  return counts;
}

/** 센 값이 없으면(조회 실패) badge를 싣지 않는다. 센 값에 없는 프로필은 안 읽은 알림이 0개다. */
export const badgeOf = (counts: Map<string, number> | null, profileId: string) =>
  counts ? { badge: counts.get(profileId) ?? 0 } : {};
