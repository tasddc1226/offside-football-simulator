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

/** 빈 D1(Miniflare)에 migration을 적용하고 격리된 `Db`를 돌려준다. 테스트 파일마다 새로 만든다. */
export async function createTestD1(): Promise<TestD1> {
  const proxy = await getPlatformProxy<Bindings>({
    configPath: WRANGLER_CONFIG_PATH,
    persist: false,
  });

  for (const statement of readMigrationStatements()) {
    await proxy.env.DB.exec(statement);
  }

  return {
    db: createDb(proxy.env.DB),
    env: proxy.env,
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
