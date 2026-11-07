// T-11-667 운영 DB 마이그레이션 무게 검사. PR에서 새로 더한 마이그레이션 SQL을 읽어 CLAUDE.md "운영 DB 마이그레이션 규칙"을
// 기계로 지킨다(2026-11-08 careers 인덱스 14개 재생성 장애, T-11-663).
//
// 1. 큰 표(BIG_TABLES)에 인덱스를 만들거나 표를 다시 쓰는 문장은 PR 전체에서 MAX_HEAVY개까지.
// 2. 같은 PR에서 같은 이름의 인덱스를 DROP하고 다시 CREATE하지 않는다(옛 코드의 INDEXED BY가 바로 깨진다). 새 이름으로 추가한다.
//
// 새벽 배포처럼 계획한 예외는 마이그레이션 파일에 `-- migration-guard: allow <이유>` 한 줄을 넣으면 그 파일을 경고만 하고 넘긴다.
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readChangedPaths } from './ci-scope.mjs';

/** 큰 표 — 2026-11-08 운영 D1 max(rowid) 5만 이상. 표가 커지면 여기에 더한다. */
export const BIG_TABLES = new Set([
  'career_seasons',
  'season_telemetry',
  'idempotency',
  'careers',
  'cards',
  'notifications',
  'pruned_careers',
  'team_lineup_cards',
  'push_results',
  'team_matches',
  'sessions',
  'push_news_deliveries',
  'profiles',
]);
export const MAX_HEAVY = 2;
const MIGRATION_DIRS = ['apps/api/migrations/', 'apps/api/migrations-ops/'];
const ALLOW = /--[ \t]*migration-guard:[ \t]*allow[ \t]+\S/i;

const ident = String.raw`[\`"\[]?([A-Za-z0-9_]+)[\`"\]]?`;
const CREATE_INDEX = new RegExp(
  String.raw`^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?${ident}\s+ON\s+${ident}`,
  'i',
);
const DROP_INDEX = new RegExp(String.raw`^DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?${ident}`, 'i');
// drizzle 표 재생성: CREATE TABLE `__new_x` → INSERT … SELECT … FROM x → DROP x → RENAME.
const CREATE_NEW_TABLE = new RegExp(
  String.raw`^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\`"\[]?__new_([A-Za-z0-9_]+)`,
  'i',
);
const UPDATE = new RegExp(String.raw`^UPDATE\s+(?:OR\s+\w+\s+)?${ident}`, 'i');

/** 주석을 빼고 문장 단위로 나눈다. */
export function statements(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/;|-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 파일 하나에서 큰 표의 무거운 문장과 인덱스 DROP · CREATE 이름을 모은다. */
export function scanMigration(file, sql, big = BIG_TABLES) {
  const heavy = [];
  const created = [];
  const dropped = [];
  for (const s of statements(sql)) {
    let m;
    if ((m = CREATE_INDEX.exec(s))) {
      created.push(m[1]);
      if (big.has(m[2])) heavy.push(`${file}: 큰 표 ${m[2]}에 인덱스 ${m[1]} 생성`);
    } else if ((m = DROP_INDEX.exec(s))) {
      dropped.push(m[1]);
    } else if ((m = CREATE_NEW_TABLE.exec(s))) {
      if (big.has(m[1])) heavy.push(`${file}: 큰 표 ${m[1]} 다시 쓰기(표 재생성)`);
    } else if ((m = UPDATE.exec(s))) {
      if (big.has(m[1])) heavy.push(`${file}: 큰 표 ${m[1]} 대량 UPDATE`);
    }
  }
  return { file, heavy, created, dropped, allowed: ALLOW.test(sql) };
}

/** 여러 파일의 결과로 오류 · 경고를 만든다. */
export function judge(scans, max = MAX_HEAVY) {
  const errors = [];
  const warnings = [];
  const counted = scans.filter((s) => !s.allowed);
  for (const s of scans.filter((x) => x.allowed && x.heavy.length))
    warnings.push(
      `${s.file}: migration-guard allow — 큰 표 작업 ${s.heavy.length}개를 세지 않았어요.`,
    );
  const heavy = counted.flatMap((s) => s.heavy);
  if (heavy.length > max)
    errors.push(
      `큰 표 인덱스 · 다시 쓰기 작업이 ${heavy.length}개예요(배포당 ${max}개까지). PR을 나눠 따로 배포해 주세요.\n  ` +
        heavy.join('\n  '),
    );
  const dropped = new Set(counted.flatMap((s) => s.dropped));
  const again = [...new Set(counted.flatMap((s) => s.created))].filter((n) => dropped.has(n));
  if (again.length)
    errors.push(
      `같은 이름의 인덱스를 지우고 다시 만들어요: ${again.join(', ')}. 옛 코드의 INDEXED BY가 배포 중에 깨지니, 새 이름으로 추가하고 옛 인덱스는 다음 배포에서 지워 주세요.`,
    );
  return { errors, warnings };
}

export function isMigrationSql(path) {
  return path.endsWith('.sql') && MIGRATION_DIRS.some((d) => path.startsWith(d));
}

export function main(env = process.env, exec = execFileSync, read = readFileSync, log = console) {
  const base = env.CI_BASE_SHA;
  const head = env.CI_HEAD_SHA;
  if (!base || !head) {
    log.log('migration-guard: CI_BASE_SHA · CI_HEAD_SHA가 없어 건너뛰어요.');
    return 0;
  }
  const added = readChangedPaths(base, head, exec, ['--diff-filter=A']).filter(isMigrationSql);
  if (!added.length) {
    log.log('migration-guard: 새 마이그레이션 없음');
    return 0;
  }
  const scans = added.map((f) => scanMigration(f, read(f, 'utf8')));
  const { errors, warnings } = judge(scans);
  for (const w of warnings) log.warn(`::warning::${w}`);
  if (errors.length) {
    for (const e of errors) log.error(`::error::${e}`);
    if (env.GITHUB_STEP_SUMMARY)
      appendFileSync(env.GITHUB_STEP_SUMMARY, `## Migration guard\n\n${errors.join('\n\n')}\n`);
    return 1;
  }
  log.log(`migration-guard: ${added.length}개 파일 통과`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main();
