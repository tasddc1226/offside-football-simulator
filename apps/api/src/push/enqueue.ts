import type { BoardKey } from '@offside/contracts';

/** 글 저장과 반드시 같은 D1 batch에 넣는다. 날짜별 PK로 동시 게시·재실행을 막는다. */
export function newsPushStatements(db: D1Database, postId: string, board: BoardKey, now: string) {
  const day = new Date(Date.parse(now) + 9 * 3600_000).toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00+09:00`).toISOString();
  const end = new Date(Date.parse(start) + 86400_000).toISOString();
  const eventId = `${board}:${day}`;
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO push_news_events
      (id, board, day, post_id, title, created_at, expires_at)
      SELECT ?, board, ?, id, title, ?, ? FROM board_posts p
      WHERE changes() > 0 AND p.id = ? AND p.board = ? AND p.created_at = ? AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM board_posts older WHERE older.board = p.board
        AND older.created_at >= ? AND older.created_at < ? AND older.id <> p.id)`,
      )
      .bind(
        eventId,
        day,
        now,
        new Date(Date.parse(now) + 86400_000).toISOString(),
        postId,
        board,
        now,
        start,
        end,
      ),
    // 재등록 때 수신자를 추가하지 않는다. 게시 시점의 유효한 동의·세션만 저장한다.
    db
      .prepare(
        `INSERT OR IGNORE INTO push_news_deliveries
      (id, event_id, installation_hash, session_id, profile_id, token, due_at, updated_at)
      SELECT ? || ':' || d.installation_hash, ?, d.installation_hash, d.session_id, d.profile_id, d.token, ?, ?
      FROM push_devices d JOIN sessions s ON s.id = d.session_id JOIN profiles p ON p.id = d.profile_id
      WHERE changes() = 1 AND s.channel = 'app' AND s.profile_id = d.profile_id
      AND s.revoked_at IS NULL AND s.expires_at > ? AND p.deleted_at IS NULL AND d.updated_at >= ?`,
      )
      .bind(
        eventId,
        eventId,
        now,
        now,
        now,
        new Date(Date.parse(now) - 90 * 86400_000).toISOString(),
      ),
  ];
}
