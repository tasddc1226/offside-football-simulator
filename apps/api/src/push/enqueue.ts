import type { BoardKey } from '@offside/contracts';

/** 글 저장과 반드시 같은 D1 batch에 넣는다. 날짜별 PK로 동시 게시·재실행을 막는다.
 * T-11-688 받는 사람(알림함 · 발송 대상)은 여기서 만들지 않는다. 기기 전체를 한 batch에서 쓰면 게시 요청 하나가
 * D1을 7초 붙잡아(2026-11-10 21:49 KST) 다른 요청이 모두 "overloaded"로 실패했다. batch가 끝난 뒤
 * fanoutNewsEvent로 기기를 조금씩 나눠 쓴다. */
export function newsPushStatements(db: D1Database, postId: string, board: BoardKey, now: string) {
  const { eventId, day, start, end } = newsEventKey(board, now);
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
  ];
}

function newsEventKey(board: BoardKey, now: string) {
  const day = new Date(Date.parse(now) + 9 * 3600_000).toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00+09:00`).toISOString();
  const end = new Date(Date.parse(start) + 86400_000).toISOString();
  return { eventId: `${board}:${day}`, day, start, end };
}

/** 한 번에 쓰는 기기 수. 한 묶음이 짧게 끝나야 사이사이 다른 요청이 D1을 쓴다. */
export const NEWS_FANOUT_CHUNK = 100;

/**
 * T-11-688 이 글이 오늘의 소식 이벤트를 만들었으면 받는 사람을 기기 묶음마다 따로 쓴다(알림함 원본 · 발송 대상).
 * 기기는 PK(installation_hash) 순서로 끊어 읽고, 같은 사람이 두 묶음에 걸쳐도 알림함은 (profile, source) 유일 키로
 * 한 번만 들어간다. 발송 대상 id도 이벤트 · 기기로 정해져 다시 돌려도 겹치지 않는다.
 */
export async function fanoutNewsEvent(
  db: D1Database,
  postId: string,
  board: BoardKey,
  now: string,
  chunk = NEWS_FANOUT_CHUNK,
): Promise<number> {
  const { eventId } = newsEventKey(board, now);
  const event = await db
    .prepare('SELECT 1 AS ok FROM push_news_events WHERE id = ? AND post_id = ? AND created_at = ?')
    .bind(eventId, postId, now)
    .first<{ ok: number }>();
  if (!event) return 0;
  const sessionExpiry = now;
  const activeSince = new Date(Date.parse(now) - 90 * 86400_000).toISOString();
  const inboxExpiry = new Date(Date.parse(now) + 90 * 86400_000).toISOString();
  let after = '';
  let devices = 0;
  for (;;) {
    const page = await db
      .prepare(
        'SELECT installation_hash AS h FROM push_devices WHERE installation_hash > ? ORDER BY installation_hash LIMIT ?',
      )
      .bind(after, chunk)
      .all<{ h: string }>();
    const ids = page.results.map((r) => r.h);
    if (!ids.length) break;
    after = ids[ids.length - 1]!;
    devices += ids.length;
    const inChunk = JSON.stringify(ids);
    await db.batch([
      // 종류를 끈 사람도 알림함 원본은 남긴다. 게시 시점의 전체 수신 등록이 유효한 프로필만 포함한다.
      db
        .prepare(
          `INSERT OR IGNORE INTO notifications
        (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
        SELECT 'ntf_' || lower(hex(randomblob(16))), d.profile_id, 'news:' || e.id, 'news',
          CASE e.board WHEN 'notice' THEN '오프사이드 공지' ELSE '오프사이드 릴리즈 노트' END,
          e.title, json_object('type', 'board', 'board', e.board, 'postId', e.post_id), ?, ?
        FROM push_news_events e CROSS JOIN push_devices d JOIN sessions s ON s.id = d.session_id JOIN profiles p ON p.id = d.profile_id
        WHERE e.id = ? AND e.post_id = ? AND d.installation_hash IN (SELECT value FROM json_each(?))
          AND s.channel = 'app' AND s.profile_id = d.profile_id AND s.revoked_at IS NULL AND s.expires_at > ?
          AND p.deleted_at IS NULL AND d.updated_at >= ? GROUP BY d.profile_id`,
        )
        .bind(now, inboxExpiry, eventId, postId, inChunk, sessionExpiry, activeSince),
      // 재등록 때 수신자를 추가하지 않는다. 게시 시점의 유효한 동의·세션·종류별 선택만 저장한다.
      db
        .prepare(
          `INSERT OR IGNORE INTO push_news_deliveries
        (id, event_id, installation_hash, session_id, profile_id, token, due_at, updated_at)
        SELECT ? || ':' || d.installation_hash, ?, d.installation_hash, d.session_id, d.profile_id, d.token, ?, ?
        FROM push_devices d JOIN sessions s ON s.id = d.session_id JOIN profiles p ON p.id = d.profile_id
        LEFT JOIN push_preferences pref ON pref.profile_id = d.profile_id
        WHERE d.installation_hash IN (SELECT value FROM json_each(?)) AND s.channel = 'app' AND s.profile_id = d.profile_id
        AND s.revoked_at IS NULL AND s.expires_at > ? AND p.deleted_at IS NULL AND d.updated_at >= ?
        AND CASE ? WHEN 'notice' THEN COALESCE(pref.notice, 1) ELSE COALESCE(pref.release, 1) END = 1`,
        )
        .bind(eventId, eventId, now, now, inChunk, sessionExpiry, activeSince, board),
    ]);
    if (ids.length < chunk) break;
  }
  return devices;
}
