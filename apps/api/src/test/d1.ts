import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy, unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import type { Bindings } from '../env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const WRANGLER_CONFIG_PATH = path.resolve(__dirname, '../../wrangler.jsonc');

/** `D1Database.exec()`는 한 줄에 한 문장만 받는다. `splitSqlQuery`로 나눈 각 문장의 내부 개행을 지우고 줄로 잇는다.
 * T-11-176 한 번의 exec로 보낸다(문장마다 exec하면 workerd 왕복이 300번 넘어 D1 하나에 1초, 한 번이면 50ms). 파일마다 한 번만 읽는다. */
let migrationSql: string | undefined;
function readMigrationSql(): string {
  return (migrationSql ??= readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) => splitSqlQuery(readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8')))
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0)
    .join('\n'));
}

export type TestD1 = {
  db: Db;
  /** `wrangler.jsonc`의 바인딩·vars 그대로. HTTP 계층 테스트가 `app.request(path, init, env)`에 넘긴다. */
  env: Bindings;
  dispose: () => Promise<void>;
};

/** 빈 D1(Miniflare)에 migration을 적용하고 격리된 `Db`를 돌려준다. 테스트 파일마다 새로 만든다.
 * migrate: false면 표 없는 빈 D1(백업 복구 테스트). */
export async function createTestD1({ migrate = true } = {}): Promise<TestD1> {
  const proxy = await getPlatformProxy<Bindings>({
    configPath: WRANGLER_CONFIG_PATH,
    persist: false,
  });

  if (migrate) await proxy.env.DB.exec(readMigrationSql());

  // T-10-072 홈 라이브 허브(Durable Object)는 빼 둔다 — 업로드가 뒤에서 허브를 부르지 않게. 허브를 보는 테스트는
  // 가짜를 넣는다(routes/liveSocket.test.ts).
  const env: Bindings = { ...proxy.env };
  delete env.LIVE;
  return {
    db: createDb(proxy.env.DB),
    env,
    dispose: () => proxy.dispose(),
  };
}

/** T-10-028 프로필을 구글 로그인한 상태로 만든다(댓글 자격). email이 ADMIN_EMAILS에 있으면 관리자다. */
export async function linkGoogle(
  ctx: TestD1,
  profileId: string,
  opts: { email?: string | null; nickname?: string | null } = {},
): Promise<void> {
  await ctx.db
    .update(profiles)
    .set({
      googleSub: `sub-${profileId}`,
      email: opts.email ?? null,
      nickname: opts.nickname ?? null,
      linkedAt: '2026-09-25T00:00:00.000Z',
    })
    .where(eq(profiles.id, profileId));
}

/** 지나간 SQL을 `seen`에 모으는 D1 — 어떤 표를 읽는지 확인하는 테스트용. */
/** D1 왕복(한 번의 HTTP 요청)으로 세는 호출: 문장 하나를 바로 실행하거나, 여러 문장을 batch로 보내는 것. */
const TRIP_METHODS = new Set(['run', 'all', 'first', 'raw']);

/**
 * seen: prepare된 SQL(문장 수). trips: D1 왕복 수(T-11-276) — 문장 실행(run/all/first/raw) 1회 또는 batch 1회.
 * batch 안의 문장은 자기 run을 부르지 않으므로 왕복 하나로만 센다. 운영에서 응답 시간은 쿼리 비용이 아니라 이 왕복 수다.
 */
export function spyDb(db: D1Database): {
  DB: D1Database;
  seen: string[];
  trips: { n: number; log: string[] };
} {
  const seen: string[] = [];
  /** log: 왕복마다 첫 문장의 앞부분(batch는 문장 수를 붙인다) — 어느 왕복이 남았는지 볼 때. */
  const trips = { n: 0, log: [] as string[] };
  const head = (q: string) => q.replace(/\s+/g, ' ').slice(0, 90);
  const trip = (label: string) => (trips.n++, trips.log.push(label));
  const statement = (stmt: D1PreparedStatement, query: string): D1PreparedStatement =>
    new Proxy(stmt, {
      get(target, key) {
        const value = Reflect.get(target, key) as unknown;
        if (typeof value !== 'function') return value;
        const fn = value as (...a: unknown[]) => unknown;
        if (key === 'bind')
          return (...a: unknown[]) => statement(fn.apply(target, a) as D1PreparedStatement, query);
        if (TRIP_METHODS.has(String(key)))
          return (...a: unknown[]) => (trip(head(query)), fn.apply(target, a));
        return fn.bind(target);
      },
    });
  const queryOf = new WeakMap<D1PreparedStatement, string>();
  const get = (target: D1Database | D1DatabaseSession, key: string | symbol) => {
    if (key === 'prepare')
      return (query: string) => {
        seen.push(query);
        const raw = target.prepare(query);
        queryOf.set(raw, query);
        return statement(raw, query);
      };
    if (key === 'batch')
      return (stmts: D1PreparedStatement[]) => (
        trip(`batch[${stmts.length}] ${head(queryOf.get(stmts[0]!) ?? '?')}`),
        target.batch(stmts)
      );
    const value = Reflect.get(target, key) as unknown;
    return typeof value === 'function'
      ? (value as (...a: unknown[]) => unknown).bind(target)
      : value;
  };
  const observe = (session: D1DatabaseSession): D1DatabaseSession =>
    new Proxy(session, { get: (target, key) => get(target, key) });
  const DB = new Proxy(db, {
    get(target, key) {
      if (key === 'withSession')
        return (...args: Parameters<D1Database['withSession']>) =>
          observe(target.withSession(...args));
      return get(target, key);
    },
  });
  return { DB, seen, trips };
}

/** T-11-080 테스트가 careers에 바로 넣은 은퇴 선수의 카드를 만든다(마이그레이션 0056·은퇴 업로드와 같은 복사). */
export async function syncCards(ctx: TestD1, cardValue: number | null = null): Promise<void> {
  await ctx.env.DB.prepare(
    `INSERT OR IGNORE INTO cards (career_id, owner_id, service_season, pos, dpos, nation, number, peak, legend_score, peak_profile, card_value, retire_value, created_at, updated_at)
     SELECT id, profile_id, coalesce(service_season, 0), pos, dpos, nation, shirt_number, peak, coalesce(legend_score, 0), peak_profile, ?, coalesce(value, 0), coalesce(retired_at, updated_at), coalesce(retired_at, updated_at)
     FROM careers WHERE status = 'retired' AND peak IS NOT NULL`,
  )
    .bind(cardValue)
    .run();
}
