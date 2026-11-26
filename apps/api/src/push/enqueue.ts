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
 * 운영은 이 함수를 요청 안에서 한 번에 돌리지 않는다(T-11-831, startNewsFanout).
 */
export async function fanoutNewsEvent(
  db: D1Database,
  postId: string,
  board: BoardKey,
  now: string,
  chunk = NEWS_FANOUT_CHUNK,
): Promise<number> {
  return (await fanoutNewsPage(db, postId, board, now, '', Infinity, chunk))?.devices ?? 0;
}

/**
 * 커서(after) 다음 기기부터 최대 maxChunks 묶음만 쓴다. 이벤트가 없으면(이 글이 오늘 이벤트를 만들지 않았으면) null.
 * done이면 마지막 기기까지 썼다.
 */
export async function fanoutNewsPage(
  db: D1Database,
  postId: string,
  board: BoardKey,
  now: string,
  after: string,
  maxChunks: number,
  chunk = NEWS_FANOUT_CHUNK,
): Promise<{ devices: number; after: string; done: boolean } | null> {
  const { eventId } = newsEventKey(board, now);
  const event = await db
    .prepare('SELECT 1 AS ok FROM push_news_events WHERE id = ? AND post_id = ? AND created_at = ?')
    .bind(eventId, postId, now)
    .first<{ ok: number }>();
  if (!event) return null;
  const sessionExpiry = now;
  const activeSince = new Date(Date.parse(now) - 90 * 86400_000).toISOString();
  const inboxExpiry = new Date(Date.parse(now) + 90 * 86400_000).toISOString();
  let devices = 0;
  for (let n = 0; n < maxChunks; n++) {
    const page = await db
      .prepare(
        'SELECT installation_hash AS h FROM push_devices WHERE installation_hash > ? ORDER BY installation_hash LIMIT ?',
      )
      .bind(after, chunk)
      .all<{ h: string }>();
    const ids = page.results.map((r) => r.h);
    if (!ids.length) return { devices, after, done: true };
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
    if (ids.length < chunk) return { devices, after, done: true };
  }
  return { devices, after, done: false };
}

// ───────── T-11-831 큐로 나눠 쓰기 ─────────
// 2026-11-26 11:49 KST 공지 게시가 기기 6,043대(61묶음)를 요청 안에서 연달아 써서 10초 만에 D1이 "overloaded"를 냈다.
// 글은 저장됐는데 응답은 503, 목록 캐시는 그대로였고, 같은 순간 다른 사람의 요청도 실패했다. 그래서 운영에서는 요청이
// 큐 메시지 하나만 남기고, 큐 소비자가 메시지마다 NEWS_FANOUT_STEP묶음씩 쓰고 NEWS_FANOUT_DELAY_S초 뒤 다음 메시지로 잇는다.
// 진행 위치는 app_meta(news-fanout:<이벤트>)에 남겨, 메시지를 잃어도 5분 cron(resumeNewsFanouts)이 이어 간다.

/** 큐 메시지 하나가 쓰는 묶음 수와 다음 메시지까지 쉬는 시간. */
export const NEWS_FANOUT_STEP = 5;
export const NEWS_FANOUT_DELAY_S = 2;
/** 진행 위치가 이만큼 멈춰 있으면 cron이 다시 넣고, 이만큼 지나면 포기하고 지운다. */
export const NEWS_FANOUT_STALL_MS = 10 * 60_000;
export const NEWS_FANOUT_GIVE_UP_MS = 2 * 86400_000;
const FANOUT_PREFIX = 'news-fanout:';

export type NewsFanoutWork = {
  version: 1;
  kind: 'fanout';
  postId: string;
  board: BoardKey;
  now: string;
  after: string;
};
type FanoutMarker = Omit<NewsFanoutWork, 'version' | 'kind'> & { at: number };

const markerKey = (w: Pick<NewsFanoutWork, 'board' | 'now'>) =>
  FANOUT_PREFIX + newsEventKey(w.board, w.now).eventId;

async function saveMarker(db: D1Database, w: NewsFanoutWork, at: number) {
  const value: FanoutMarker = {
    postId: w.postId,
    board: w.board,
    now: w.now,
    after: w.after,
    at,
  };
  await db
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .bind(markerKey(w), JSON.stringify(value))
    .run();
}

type FanoutEnv = { DB: D1Database; PUSH_QUEUE?: Queue<unknown> | undefined };

/** 큐 소비자는 운영 큐에만 붙어 있다. 그 밖의 환경은 큐 없이(바로 다 쓰기) 넘긴다. */
export const fanoutEnvOf = (env: {
  DB: D1Database;
  ENVIRONMENT?: string | undefined;
  PUSH_QUEUE?: Queue<unknown> | undefined;
}): FanoutEnv => ({
  DB: env.DB,
  PUSH_QUEUE: env.ENVIRONMENT === 'production' ? env.PUSH_QUEUE : undefined,
});

/**
 * 글 저장 뒤 받는 사람 쓰기를 시작한다. 큐가 있으면(운영) 진행 위치를 남기고 메시지 하나만 넣어 true, 없으면(로컬 · 테스트)
 * 예전처럼 바로 다 쓰고 false. 이 글이 오늘 이벤트를 만들지 않았으면 아무것도 하지 않는다.
 */
export async function startNewsFanout(
  env: FanoutEnv,
  postId: string,
  board: BoardKey,
  now: string,
  at = Date.now(),
): Promise<boolean> {
  if (!env.PUSH_QUEUE) {
    await fanoutNewsEvent(env.DB, postId, board, now);
    return false;
  }
  const { eventId } = newsEventKey(board, now);
  const event = await env.DB.prepare(
    'SELECT 1 AS ok FROM push_news_events WHERE id = ? AND post_id = ? AND created_at = ?',
  )
    .bind(eventId, postId, now)
    .first<{ ok: number }>();
  if (!event) return true;
  const work: NewsFanoutWork = { version: 1, kind: 'fanout', postId, board, now, after: '' };
  await saveMarker(env.DB, work, at);
  // 보내기가 실패해도 진행 위치가 남아 cron이 이어 간다. 글 저장 응답은 실패로 바꾸지 않는다.
  await env.PUSH_QUEUE.send(work).catch(() => {
    console.error(JSON.stringify({ job: 'news-fanout', error: 'QUEUE_SEND_FAILED' }));
  });
  return true;
}

/** 큐 메시지 하나: 몇 묶음 쓰고 다음 메시지를 넣거나, 끝났으면 진행 위치를 지우고 true(발송을 깨운다). */
export async function runNewsFanout(
  env: FanoutEnv,
  work: NewsFanoutWork,
  at = Date.now(),
): Promise<boolean> {
  const page = await fanoutNewsPage(
    env.DB,
    work.postId,
    work.board,
    work.now,
    work.after,
    NEWS_FANOUT_STEP,
  );
  if (!page || page.done) {
    await env.DB.prepare('DELETE FROM app_meta WHERE key = ?').bind(markerKey(work)).run();
    return !!page;
  }
  const next: NewsFanoutWork = { ...work, after: page.after };
  await saveMarker(env.DB, next, at);
  if (!env.PUSH_QUEUE) throw new Error('PUSH_QUEUE binding missing');
  await env.PUSH_QUEUE.send(next, { delaySeconds: NEWS_FANOUT_DELAY_S });
  return false;
}

/** 5분 cron: 멈춘 진행 위치를 다시 큐에 넣는다(같은 기기를 다시 써도 겹치지 않는다). 너무 오래된 것은 지운다. */
export async function resumeNewsFanouts(env: FanoutEnv, at = Date.now()): Promise<number> {
  if (!env.PUSH_QUEUE) return 0;
  const { results } = await env.DB.prepare(
    'SELECT key, value FROM app_meta WHERE key >= ? AND key < ? LIMIT 20',
  )
    .bind(FANOUT_PREFIX, FANOUT_PREFIX + '\uffff')
    .all<{ key: string; value: string }>();
  let resumed = 0;
  for (const row of results) {
    let m: FanoutMarker | null;
    try {
      m = JSON.parse(row.value) as FanoutMarker;
    } catch {
      m = null;
    }
    if (!m || at - Date.parse(m.now) > NEWS_FANOUT_GIVE_UP_MS) {
      await env.DB.prepare('DELETE FROM app_meta WHERE key = ?').bind(row.key).run();
      continue;
    }
    if (at - m.at < NEWS_FANOUT_STALL_MS) continue;
    const work: NewsFanoutWork = {
      version: 1,
      kind: 'fanout',
      postId: m.postId,
      board: m.board,
      now: m.now,
      after: m.after,
    };
    await saveMarker(env.DB, work, at);
    await env.PUSH_QUEUE.send(work);
    resumed++;
  }
  return resumed;
}
