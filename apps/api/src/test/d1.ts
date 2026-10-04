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

/** `D1Database.exec()`는 한 줄에 한 문장만 받는다. `splitSqlQuery`로 나눈 각 문장의 내부 개행을 지운다. */
function readMigrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) => splitSqlQuery(readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8')))
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0);
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

  if (migrate) {
    for (const statement of readMigrationStatements()) {
      await proxy.env.DB.exec(statement);
    }
  }

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
export function spyDb(db: D1Database): { DB: D1Database; seen: string[] } {
  const seen: string[] = [];
  const DB = new Proxy(db, {
    get(target, key) {
      if (key === 'prepare') return (query: string) => (seen.push(query), target.prepare(query));
      const v = Reflect.get(target, key) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
  return { DB, seen };
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
