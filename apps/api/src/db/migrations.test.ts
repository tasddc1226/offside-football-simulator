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

/** 브리프 표의 컬럼 목록과 같다(snake_case). */
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
  auth_attempts: ['id', 'kind', 'subject', 'window_start', 'count'],
  locker_teams: [
    'id',
    'owner_profile_id',
    'name',
    'formation',
    'lineup_json',
    'revision',
    'created_at',
    'updated_at',
  ],
  locker_player_notes: ['career_id', 'note', 'updated_at'],
  competition_challenge_versions: [
    'id',
    'day_key',
    'week_key',
    'starts_at',
    'ends_at',
    'ruleset_version',
    'content_pack_version',
    'scoring_policy_version',
    'scenario_json',
    'created_at',
  ],
  competition_entries: [
    'id',
    'challenge_version_id',
    'owner_profile_id',
    'request_key_hash',
    'request_hash',
    'action_ids_json',
    'result_json',
    'result_hash',
    'score',
    'max_score',
    'verification_status',
    'public_opt_in',
    'public_alias',
    'submitted_at',
  ],
  audit_log: ['id', 'kind', 'profile_id', 'payload_json', 'created_at'],
  sessions: [
    'id',
    'profile_id',
    'channel',
    'token_hash',
    'created_at',
    'expires_at',
    'revoked_at',
    'last_seen_at',
    'pending_merge_profile_id',
    'pending_merge_expires_at',
  ],
  careers: [
    'id',
    'owner_profile_id',
    'status',
    'revision',
    'created_service_season_id',
    'ruleset_version',
    'content_pack_version',
    'verification_status',
    'last_synced_at',
    'created_at',
    'updated_at',
    'archived_at',
  ],
  snapshots: [
    'id',
    'career_id',
    'revision',
    'checkpoint',
    'state',
    'state_hash',
    'ruleset_version',
    'content_pack_version',
    'rng_state_json',
    'created_at',
  ],
  command_log: [
    'career_id',
    'revision',
    'command_id',
    'command_type',
    'payload_json',
    'result_hash',
    'created_at',
  ],
  idempotency: [
    'owner_profile_id',
    'key',
    'request_hash',
    'response_status',
    'response_body',
    'created_at',
    'expires_at',
  ],
  service_seasons: [
    'id',
    'name',
    'status',
    'starts_at',
    'ends_at',
    'ruleset_version',
    'content_pack_version',
    'challenge_set_id',
    'is_test',
  ],
  analytics_events: [
    'id',
    'client_id',
    'profile_id',
    'name',
    'props_json',
    'client_ts',
    'received_at',
  ],
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

  it('is not idempotent: reapplying the migration on the same DB fails', async () => {
    const [createCareers] = firstMigrationStatements();
    if (!createCareers) throw new Error('expected at least one statement');
    await expect(ctx.db.$client.exec(createCareers)).rejects.toThrow();
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
