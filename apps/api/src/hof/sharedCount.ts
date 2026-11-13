// T-11-688 명예의 전당 전체 인원을 데이터센터마다 · 요청마다 새로 세지 않는다.
// 2026-11-10 21:54 KST 엣지 캐시(5분)가 끝나는 순간 몰린 요청 68개가 각자 은퇴 커리어 약 21만 행을 세어
// 10초 안에 1,400만 행을 읽었고, D1이 "overloaded"로 2분 넘게 멈췄다.
// 개수는 app_meta에 한 벌만 두고, 오래됐으면 한 요청만(조건부 UPDATE로 잡은 쪽) 뒤에서 다시 센다.
// 나머지 요청은 그동안 이전 값을 그대로 돌려준다(새 은퇴가 몇 분 늦게 반영되는 것만 감수한다).

/** 이 시간 안의 값은 그대로 쓴다. */
export const COUNT_FRESH_MS = 10 * 60_000;
/** 다시 세는 쪽이 죽어도 이 시간이 지나면 다른 요청이 다시 잡는다. */
export const COUNT_LOCK_MS = 60_000;
/** 처음 세는 키에서 잡지 못한 요청이 값을 기다리는 횟수와 간격. */
const FIRST_WAIT_TRIES = 6;
const FIRST_WAIT_MS = 250;

type Stored = { n?: number; at?: number; lock?: number };
type CountDb = D1Database | D1DatabaseSession;

const metaKey = (key: string) => `hof_count:${key}`;

function parse(raw: string | undefined): Stored | undefined {
  if (raw === undefined) return undefined;
  try {
    const v = JSON.parse(raw) as Stored;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

async function read(db: CountDb, key: string): Promise<string | undefined> {
  const row = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(metaKey(key))
    .first<{ value: string }>();
  return row?.value;
}

async function write(db: CountDb, key: string, n: number, now: number) {
  await db
    .prepare('UPDATE app_meta SET value = ? WHERE key = ?')
    .bind(JSON.stringify({ n, at: now }), metaKey(key))
    .run();
}

/** 이전 값이 raw 그대로일 때만 lock을 건다(다른 요청이 먼저 잡았으면 false). */
async function claim(db: CountDb, key: string, raw: string, prev: Stored, now: number) {
  const res = await db
    .prepare('UPDATE app_meta SET value = ? WHERE key = ? AND value = ?')
    .bind(JSON.stringify({ ...prev, lock: now }), metaKey(key), raw)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sharedCount(
  db: CountDb,
  key: string,
  load: () => Promise<number>,
  background: (p: Promise<unknown>) => void,
  now = Date.now(),
): Promise<number> {
  const raw = await read(db, key);
  const cur = parse(raw);
  if (raw !== undefined && cur && typeof cur.n === 'number') {
    if (now - (cur.at ?? 0) < COUNT_FRESH_MS) return cur.n;
    const locked = cur.lock !== undefined && now - cur.lock < COUNT_LOCK_MS;
    if (!locked && (await claim(db, key, raw, cur, now)))
      background(load().then((n) => write(db, key, n, now)));
    return cur.n;
  }
  // 처음 세는 키: 자리를 먼저 잡은 요청만 센다.
  const won =
    raw === undefined
      ? ((
          await db
            .prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)')
            .bind(metaKey(key), JSON.stringify({ lock: now }))
            .run()
        ).meta?.changes ?? 0) > 0
      : !(cur?.lock !== undefined && now - cur.lock < COUNT_LOCK_MS) &&
        (await claim(db, key, raw, cur ?? {}, now));
  if (won) {
    const n = await load();
    await write(db, key, n, now);
    return n;
  }
  for (let i = 0; i < FIRST_WAIT_TRIES; i++) {
    await sleep(FIRST_WAIT_MS);
    const v = parse(await read(db, key));
    if (v && typeof v.n === 'number') return v.n;
  }
  // 세던 쪽이 끝나지 않았다. 이 요청만 직접 센다(드물다).
  return load();
}
