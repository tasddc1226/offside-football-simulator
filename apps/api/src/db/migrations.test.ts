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
  if (!statement)
    throw new Error('expected a CREATE TABLE `profiles` statement in the first migration');
  return statement;
}

/**
 * T-9-001a: 로그인·프로필만 남기고(0015에서 나머지 테이블을 모두 DROP) 최종 테이블 집합은 이
 * 5개뿐이다. 컬럼 목록은 schema.ts와 같다(snake_case).
 */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  push_devices: [
    'installation_hash',
    'session_id',
    'profile_id',
    'token',
    'platform',
    'app_version',
    'updated_at',
    'last_test_ticket_id',
    'last_test_sent_at',
  ],
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
    'nickname',
    'apple_sub',
    'apple_linked_at',
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
  app_auth_tickets: ['id', 'session_id', 'challenge', 'code_verifier', 'expires_at', 'profile_id'],
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
    'dpos',
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
    'title',
    'last_club_id',
    'peak_profile',
    'card_attrs_json',
    'service_season',
    // T-10-096 국적·체격.
    'nation',
    'height',
    'weight',
    'value',
    'name_hidden_at',
    'hidden',
    'pot',
    'pot_real',
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
    'club_id',
    'signals_json',
    'growth_json',
  ],
  club_customs: ['profile_id', 'clubs_json', 'updated_at'],
  // T-10-011: 게시판.
  board_posts: [
    'id',
    'board',
    'title',
    'body',
    'version',
    'pinned',
    'author_profile_id',
    'created_at',
    'updated_at',
    'deleted_at',
    // T-10-058: 조회수·좋아요 수.
    'view_count',
    'like_count',
  ],
  board_post_likes: ['post_id', 'profile_id', 'created_at'],
  board_comments: [
    'id',
    'post_id',
    'profile_id',
    'nickname',
    'body',
    'admin',
    'created_at',
    'deleted_at',
  ],
  board_comment_reports: ['comment_id', 'profile_id', 'reason', 'created_at'],
  board_blocks: ['id', 'profile_id', 'blocked_profile_id', 'nickname', 'created_at'],
  name_reports: ['kind', 'target_id', 'profile_id', 'name', 'created_at', 'resolved_at'],
  chat_reports: [
    'message_id',
    'profile_id',
    'reason',
    'author_profile_id',
    'nickname',
    'body',
    'created_at',
    'resolved_at',
  ],
  chat_mutes: ['profile_id', 'until', 'created_at'],
  balance_versions: [
    'version',
    'status',
    'note',
    'values_json',
    'created_by',
    'created_at',
    'updated_at',
    'activated_at',
  ],
  server_firsts: ['season', 'id', 'career_id', 'achieved_at', 'year'],
  app_meta: ['key', 'value'],
  server_records: ['season', 'id', 'career_id', 'value', 'achieved_at', 'year'],
  retired_numbers: [
    'season',
    'club_id',
    'number',
    'career_id',
    'club',
    'score',
    'seq',
    'granted_at',
  ],
  owner_teams: [
    'id',
    'profile_id',
    'name',
    'formation',
    'slots_json',
    'layout_json',
    'logo_json',
    'filled',
    'ovr',
    'wins',
    'draws',
    'losses',
    'created_at',
    'updated_at',
    // 시즌별 팀 · 감독 · 레이팅 · 히스토리 · 좋아요/조회수.
    'season',
    'manager',
    'rating',
    'goals_for',
    'goals_against',
    'streak',
    'best_streak',
    'best_margin',
    'likes',
    'views',
  ],
  team_likes: ['team_id', 'profile_id', 'created_at'],
  owner_achievements: [
    'profile_id',
    'season',
    'score',
    'done',
    'players',
    'reached_at',
    'updated_at',
  ],
  team_matches: [
    'id',
    'profile_id',
    'home_team_id',
    'away_team_id',
    'home_goals',
    'away_goals',
    'detail_json',
    'created_at',
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

  it('T-11-064: 내 선수·구단주 팀 조회는 profile_id 인덱스로 시작한다(은퇴 선수 전체를 훑지 않는다)', async () => {
    const plans = [
      "select id from careers where profile_id = 'p' and status = 'retired' and peak is not null and hidden = 0 and service_season = 1 order by peak desc limit 5",
      "select id from careers where profile_id = 'p' and status = 'retired' and legend_score is not null order by legend_score desc, retired_at limit 5",
    ];
    for (const sql of plans) {
      const result = await ctx.db.$client
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all<{ detail: string }>();
      expect(result.results.map((r) => r.detail).join('\n'), sql).toMatch(/\(profile_id=\?/);
    }
  });

  it('전체 마이그레이션을 적용한 최종 테이블 집합은 정확히 EXPECTED_COLUMNS의 테이블뿐이다', async () => {
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

  it('0044: 기존 영구결번에 커리어의 service_season(NULL이면 0)을 채우고 seq를 시즌마다 다시 센다', async () => {
    const proxy = await getPlatformProxy<Bindings>({
      configPath: WRANGLER_CONFIG_PATH,
      persist: false,
    });
    try {
      const names = readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.sql') && name < '0044')
        .sort();
      for (const name of names) {
        for (const statement of migrationStatements(name)) await proxy.env.DB.exec(statement);
      }
      await proxy.env.DB.exec(
        "INSERT INTO profiles (id, settings_json, created_at, last_seen_at) VALUES ('profile', '{}', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')",
      );
      // c-null: 시즌 NULL(휴식기), c-pre: 프리시즌, c-s1: 시즌 1.
      for (const [id, season] of [
        ['c-null', 'NULL'],
        ['c-pre', '0'],
        ['c-s1', '1'],
      ] as const) {
        await proxy.env.DB.exec(
          `INSERT INTO careers (id, profile_id, pos, foot, type, trait, start_year, status, app_version, service_season, created_at, updated_at) VALUES ('${id}', 'profile', 'FW', '오른발', 'poacher', 'late', 2026, 'retired', '1.0.0', ${season}, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')`,
        );
      }
      for (const [id, seq] of [
        ['c-pre', 1],
        ['c-s1', 2],
        ['c-null', 3],
      ] as const) {
        await proxy.env.DB.exec(
          `INSERT INTO retired_numbers (club_id, number, career_id, club, score, seq, granted_at) VALUES ('pl-${seq}', 10, '${id}', '구단', 900, ${seq}, '2026-09-01T00:00:00Z')`,
        );
      }

      await proxy.env.DB.batch(
        migrationStatements('0044_season_split.sql').map((statement) =>
          proxy.env.DB.prepare(statement),
        ),
      );

      const rows = await proxy.env.DB.prepare(
        'SELECT career_id, season, seq FROM retired_numbers ORDER BY career_id',
      ).all<{ career_id: string; season: number; seq: number }>();
      expect(rows.results).toEqual([
        { career_id: 'c-null', season: 0, seq: 2 },
        { career_id: 'c-pre', season: 0, seq: 1 },
        { career_id: 'c-s1', season: 1, seq: 1 },
      ]);
      // 시즌이 다르면 같은 구단·번호도 들어간다. 한 커리어는 한 자리(unique)를 유지한다.
      await proxy.env.DB.exec(
        "INSERT INTO retired_numbers (season, club_id, number, career_id, club, score, seq, granted_at) VALUES (1, 'pl-1', 10, 'c-s1', '구단', 900, 9, '2026-09-01T00:00:00Z')",
      ).then(
        () => {
          throw new Error('한 커리어가 두 자리를 가졌다');
        },
        () => undefined,
      );
      expect((await proxy.env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
    } finally {
      await proxy.dispose();
    }
  });
});
