import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy, unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import type { Bindings } from '../env.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const WRANGLER_CONFIG_PATH = path.resolve(__dirname, '../../wrangler.jsonc');

function migrationStatements(name: string): string[] {
  return splitSqlQuery(readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0);
}

function firstMigrationStatements(): string[] {
  const [first] = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (!first) throw new Error('no migration file found');
  return splitSqlQuery(readFileSync(path.join(MIGRATIONS_DIR, first), 'utf8')).map((statement) =>
    statement.replace(/\s+/g, ' ').trim(),
  );
}

/** T-9-001a: 0000의 첫 문장은 이제 0015에서 DROP된 `careers`라 재적용해도 실패하지 않는다.
 * 최종까지 남는 `profiles` CREATE 문을 대신 고른다. */
function firstProfilesCreateStatement(): string {
  const statement = firstMigrationStatements().find((s) => s.startsWith('CREATE TABLE `profiles`'));
  if (!statement) throw new Error('expected a CREATE TABLE `profiles` statement in the first migration');
  return statement;
}

/**
 * T-9-001a: 로그인·프로필만 남기고(0015에서 나머지 테이블을 모두 DROP) 최종 테이블 집합은 이
 * 5개뿐이다. 컬럼 목록은 schema.ts와 같다(snake_case).
 */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  profiles: [
    'id',
    'recovery_code_hash',
    'recovery_code_issued_at',
    'google_sub',
    'email',
    'linked_at',
    'toss_anon_key_hash',
    'toss_linked_at',
    'settings_json',
    'created_at',
    'last_seen_at',
    'deleted_at',
  ],
  sessions: [
    'id',
    'profile_id',
    'channel',
    'token_hash',
    'created_at',
    'expires_at',
    'revoked_at',
    'last_seen_at',
  ],
  auth_attempts: ['id', 'kind', 'subject', 'window_start', 'count'],
  audit_log: ['id', 'kind', 'profile_id', 'payload_json', 'created_at'],
  idempotency: [
    'owner_profile_id',
    'key',
    'request_hash',
    'response_status',
    'response_body',
    'created_at',
    'expires_at',
  ],
  // T-9-009: 커리어·시즌 요약 저장(익명 포함 전체 사용자).
  careers: [
    'id',
    'profile_id',
    'pos',
    'foot',
    'type',
    'trait',
    'start_year',
    'status',
    'app_version',
    'created_at',
    'updated_at',
    'retired_at',
    'retire_age',
    'peak',
    'legend_score',
    'apps',
    'goals',
    'assists',
    'trophies',
    'awards',
    'caps',
    'ballon',
    'last_club',
    'public_name',
    'shirt_number',
    'snapshot_json',
  ],
  career_seasons: [
    'career_id',
    'year',
    'age',
    'club',
    'league',
    'apps',
    'goals',
    'assists',
    'rating',
    'rank',
    'ovr',
    'honors_json',
    'mil',
    'events_json',
    'created_at',
    'cs',
    'lg_apps',
    'lg_goals',
    'caps',
    'comps_json',
    'ch_json',
  ],
  club_customs: ['profile_id', 'clubs_json', 'updated_at'],
  // T-10-011: 게시판.
  board_posts: ['id', 'board', 'title', 'body', 'version', 'pinned', 'author_profile_id', 'created_at', 'updated_at', 'deleted_at'],
  board_comments: ['id', 'post_id', 'profile_id', 'nickname', 'body', 'admin', 'created_at', 'deleted_at'],
  balance_versions: ['version', 'status', 'note', 'values_json', 'created_by', 'created_at', 'updated_at', 'activated_at'],
};

describe('migrations', () => {
  let ctx: TestD1;

  beforeAll(async () => {
    ctx = await createTestD1();
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it('creates the required tables with the expected columns', async () => {
    for (const [table, expectedColumns] of Object.entries(EXPECTED_COLUMNS)) {
      const result = await ctx.db.$client
        .prepare(`PRAGMA table_info(${table})`)
        .all<{ name: string }>();
      const columns = result.results.map((row) => row.name).sort();
      expect(columns, `table ${table}`).toEqual([...expectedColumns].sort());
    }
  });

  it('전체 마이그레이션을 적용한 최종 테이블 집합은 정확히 이 10개뿐이다(0015: 게임 데이터 테이블 DROP, 0016: careers·career_seasons, 0019: club_customs, 0020: board_posts·board_comments 추가)', async () => {
    const result = await ctx.db.$client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
      )
      .all<{ name: string }>();
    const tables = result.results.map((row) => row.name).sort();
    expect(tables).toEqual(Object.keys(EXPECTED_COLUMNS).sort());
  });

  it('is not idempotent: reapplying the migration on the same DB fails', async () => {
    const createProfiles = firstProfilesCreateStatement();
    await expect(ctx.db.$client.exec(createProfiles)).rejects.toThrow();
  });

  it('makes ends_at nullable without losing an existing career and its evidence', async () => {
    const proxy = await getPlatformProxy<Bindings>({
      configPath: WRANGLER_CONFIG_PATH,
      persist: false,
    });
    try {
      const names = readdirSync(MIGRATIONS_DIR)
        .filter((name) => /^000[0-4].*\.sql$/.test(name))
        .sort();
      for (const name of names) {
        for (const statement of migrationStatements(name)) await proxy.env.DB.exec(statement);
      }
      await proxy.env.DB.exec(
        "INSERT INTO profiles (id, settings_json, created_at, last_seen_at) VALUES ('profile', '{}', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')",
      );
      await proxy.env.DB.exec(
        "INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test) VALUES ('season', 'Season', 'ACTIVE', '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', '1.0.0', '0.1.0', 'challenge', 0)",
      );
      await proxy.env.DB.exec(
        "INSERT INTO careers (id, owner_profile_id, status, revision, created_service_season_id, ruleset_version, content_pack_version, last_synced_at, created_at, updated_at) VALUES ('career', 'profile', 'RETIRED', 1, 'season', '1.0.0', '0.1.0', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')",
      );
      await proxy.env.DB.exec(
        "INSERT INTO snapshots (id, career_id, revision, checkpoint, state, state_hash, ruleset_version, content_pack_version, rng_state_json, created_at) VALUES ('snapshot', 'career', 1, 'RETIREMENT', '{}', 'hash', '1.0.0', '0.1.0', '{}', '2026-09-01T00:00:00Z')",
      );
      await proxy.env.DB.exec(
        "INSERT INTO command_log (career_id, revision, command_id, command_type, payload_json, result_hash, created_at) VALUES ('career', 1, 'command', 'RETIRE', '{}', 'hash', '2026-09-01T00:00:00Z')",
      );
      await proxy.env.DB.exec(
        "INSERT INTO career_archives (career_id, retirement_revision, archive_hash, archive_json, legacy_version, legacy_json, created_at) VALUES ('career', 1, 'archive-hash', '{}', '1.0.0', '{}', '2026-09-01T00:00:00Z')",
      );

      await proxy.env.DB.batch(
        migrationStatements('0005_adorable_tombstone.sql').map((statement) =>
          proxy.env.DB.prepare(statement),
        ),
      );

      const season = await proxy.env.DB.prepare(
        "SELECT ends_at FROM service_seasons WHERE id = 'season'",
      ).first<{ ends_at: string | null }>();
      expect(season?.ends_at).toBe('2026-12-31T23:59:59Z');
      expect(
        await proxy.env.DB.prepare(
          "SELECT count(*) AS count FROM careers WHERE id = 'career'",
        ).first(),
      ).toMatchObject({ count: 1 });
      expect(
        await proxy.env.DB.prepare(
          "SELECT count(*) AS count FROM snapshots WHERE career_id = 'career'",
        ).first(),
      ).toMatchObject({ count: 1 });
      expect(
        await proxy.env.DB.prepare(
          "SELECT count(*) AS count FROM command_log WHERE career_id = 'career'",
        ).first(),
      ).toMatchObject({ count: 1 });
      expect(
        await proxy.env.DB.prepare(
          "SELECT count(*) AS count FROM career_archives WHERE career_id = 'career'",
        ).first(),
      ).toMatchObject({ count: 1 });
      expect((await proxy.env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
    } finally {
      await proxy.dispose();
    }
  });
});
