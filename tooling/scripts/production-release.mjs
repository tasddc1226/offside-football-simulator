import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// 운영 시즌 1 manifest의 정본. 다음 여섯 곳이 이 값과 같아야 한다 — 바꿀 때 함께 갱신한다.
//   - .github/workflows/deploy-production.yml: verify 단계가 `expect-version` 명령으로 이 값을 읽는다.
//   - apps/api/src/sync/season-version-compatibility.ts: APPROVED_PRODUCTION_MANIFESTS.
//   - apps/web/src/engine/versions.ts: ACTIVE_RULESET_VERSION / ACTIVE_CONTENT_PACK_VERSION(오프라인 폴백).
//   - apps/api/seeds/bootstrap-non-production.sql: staging `svc_line_test`(main push CI가 upsert).
//   - apps/web/playwright.smoke.config.ts: expectedSeason(main push CI staging smoke가 위 seed를 검증).
//   - apps/web/e2e/staging-rehearsal.spec.ts: expectedRulesetVersion / expectedContentPackVersion(수동 리허설).
export const PRODUCTION_SEASON = Object.freeze({
  id: 'svc_season_1',
  name: '시즌 1',
  status: 'ACTIVE',
  rulesetVersion: '3.2.0',
  contentPackVersion: '0.11.0',
  isTest: 0,
});

// decideSeason은 DB 행이 정확히 이 pair일 때만 PRODUCTION_SEASON으로 compare-and-set한다.
export const PREVIOUS_PRODUCTION_VERSION = Object.freeze({
  rulesetVersion: '3.1.0',
  contentPackVersion: '0.10.0',
});

function rowsFromWrangler(value) {
  const blocks = Array.isArray(value) ? value : [value];
  if (blocks.length === 0) throw new Error('Wrangler returned an empty response envelope.');
  return blocks.flatMap((block) => {
    if (block?.success === false) throw new Error('Wrangler reported an unsuccessful D1 query.');
    if (Array.isArray(block?.results)) return block.results;
    if (
      Array.isArray(block?.result) &&
      block.result.every((entry) => Array.isArray(entry?.results))
    ) {
      return block.result.flatMap((entry) => entry.results);
    }
    throw new Error('Wrangler response did not contain a D1 results array.');
  });
}

function isoInstant(value, field) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${field} must be an RFC3339 UTC instant such as 2026-09-06T00:00:00Z.`);
  }
  return value;
}

function identifier(value, field) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
    throw new Error(
      `${field} must contain only lowercase letters, digits, underscores, or hyphens.`,
    );
  }
  return value;
}

export function validateProposal(input, { required = true } = {}) {
  const present = Boolean(input.startsAt || input.endsAt || input.challengeSetId);
  if (!required && !present) return null;
  if (!input.startsAt || !input.challengeSetId) {
    throw new Error('startsAt and challengeSetId must be provided together.');
  }
  const startsAt = isoInstant(input.startsAt, 'startsAt');
  const endsAt = input.endsAt ? isoInstant(input.endsAt, 'endsAt') : null;
  if (endsAt && Date.parse(startsAt) >= Date.parse(endsAt))
    throw new Error('startsAt must be before endsAt.');
  return {
    ...PRODUCTION_SEASON,
    startsAt,
    endsAt,
    challengeSetId: identifier(input.challengeSetId, 'challengeSetId'),
  };
}

export function inspectSchema(json) {
  const tables = rowsFromWrangler(json)
    .map((row) => row.name)
    .filter((name) => typeof name === 'string')
    .sort();
  return {
    tableCount: tables.length,
    tables,
    hasServiceSeasons: tables.includes('service_seasons'),
  };
}

export function inspectServiceSeasons(json) {
  const requiredKeys = [
    'id',
    'name',
    'status',
    'starts_at',
    'ends_at',
    'ruleset_version',
    'content_pack_version',
    'challenge_set_id',
    'is_test',
  ];
  return rowsFromWrangler(json).map((row) => {
    if (!requiredKeys.every((key) => Object.hasOwn(row, key))) {
      throw new Error('Service-season query did not return every required metadata column.');
    }
    return {
      id: String(row.id),
      name: String(row.name),
      status: String(row.status),
      startsAt: String(row.starts_at),
      endsAt: row.ends_at === null ? null : String(row.ends_at),
      rulesetVersion: String(row.ruleset_version),
      contentPackVersion: String(row.content_pack_version),
      challengeSetId: String(row.challenge_set_id),
      isTest: Number(row.is_test),
    };
  });
}

export function inspectCounts(json) {
  return rowsFromWrangler(json).map((row) => ({
    table: String(row.table_name),
    rows: Number(row.row_count),
  }));
}

export function decideSeason(candidateRows, proposal) {
  const conflictingSameId = candidateRows.find(
    (row) => row.id === proposal.id && row.status !== 'ACTIVE',
  );
  if (conflictingSameId)
    throw new Error(
      `Season ${proposal.id} already exists with status ${conflictingSameId.status}.`,
    );
  const activeRows = candidateRows.filter((row) => row.status === 'ACTIVE');
  if (activeRows.length > 1)
    throw new Error(`Expected at most one ACTIVE season; found ${activeRows.length}.`);
  if (activeRows.length === 1) {
    const actual = activeRows[0];
    const equal = Object.entries(proposal).every(([key, value]) => actual[key] === value);
    if (equal) return { action: 'noop', sql: null, rollbackSql: null };
    const fixedKeys = ['id', 'name', 'status', 'startsAt', 'endsAt', 'challengeSetId', 'isTest'];
    const isExactPrevious =
      fixedKeys.every((key) => actual[key] === proposal[key]) &&
      actual.rulesetVersion === PREVIOUS_PRODUCTION_VERSION.rulesetVersion &&
      actual.contentPackVersion === PREVIOUS_PRODUCTION_VERSION.contentPackVersion;
    if (!isExactPrevious)
      throw new Error(`A different ACTIVE season already exists (${actual.id}).`);
    const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const fixedWhere = `id = ${quote(proposal.id)} AND name = ${quote(proposal.name)} AND status = 'ACTIVE'\n  AND starts_at = ${quote(proposal.startsAt)} AND ${proposal.endsAt === null ? 'ends_at IS NULL' : `ends_at = ${quote(proposal.endsAt)}`}\n  AND challenge_set_id = ${quote(proposal.challengeSetId)} AND is_test = 0`;
    return {
      action: 'activate',
      sql: `UPDATE service_seasons\nSET ruleset_version = ${quote(proposal.rulesetVersion)}, content_pack_version = ${quote(proposal.contentPackVersion)}\nWHERE ${fixedWhere}\n  AND ruleset_version = ${quote(PREVIOUS_PRODUCTION_VERSION.rulesetVersion)}\n  AND content_pack_version = ${quote(PREVIOUS_PRODUCTION_VERSION.contentPackVersion)};\n`,
      rollbackSql: `UPDATE service_seasons\nSET ruleset_version = ${quote(PREVIOUS_PRODUCTION_VERSION.rulesetVersion)}, content_pack_version = ${quote(PREVIOUS_PRODUCTION_VERSION.contentPackVersion)}\nWHERE ${fixedWhere}\n  AND ruleset_version = ${quote(proposal.rulesetVersion)}\n  AND content_pack_version = ${quote(proposal.contentPackVersion)};\n`,
    };
  }
  throw new Error('The existing ACTIVE svc_season_1 row is required for an in-place release.');
}

export function decideSeasonEnd(candidateRows, proposal) {
  const activeRows = candidateRows.filter((row) => row.status === 'ACTIVE');
  if (activeRows.length !== 1 || activeRows[0].id !== proposal.id) {
    throw new Error('Season-end changes require exactly svc_season_1 to be ACTIVE.');
  }
  const actual = activeRows[0];
  const fixedKeys = [
    'id',
    'name',
    'status',
    'startsAt',
    'rulesetVersion',
    'contentPackVersion',
    'challengeSetId',
    'isTest',
  ];
  if (!fixedKeys.every((key) => actual[key] === proposal[key])) {
    throw new Error('Production season metadata differs from the approved fixed values.');
  }
  if (actual.endsAt === proposal.endsAt) return { action: 'noop', sql: null };
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const target = proposal.endsAt === null ? 'NULL' : quote(proposal.endsAt);
  const previous = actual.endsAt === null ? 'ends_at IS NULL' : `ends_at = ${quote(actual.endsAt)}`;
  return {
    action: 'update-end',
    sql: `UPDATE service_seasons SET ends_at = ${target}\nWHERE id = ${quote(proposal.id)} AND name = ${quote(proposal.name)} AND status = 'ACTIVE'\n  AND starts_at = ${quote(proposal.startsAt)} AND ruleset_version = ${quote(proposal.rulesetVersion)}\n  AND content_pack_version = ${quote(proposal.contentPackVersion)} AND challenge_set_id = ${quote(proposal.challengeSetId)}\n  AND is_test = 0 AND ${previous};\n`,
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function appendSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY)
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, path] = process.argv.slice(2);
  if (command === 'schema') {
    const result = inspectSchema(readJson(path));
    appendSummary([
      '### Production D1 preflight',
      `- schema tables: ${result.tableCount}`,
      `- service_seasons present: ${result.hasServiceSeasons}`,
    ]);
    process.stdout.write(result.hasServiceSeasons ? 'true' : 'false');
  } else if (command === 'bookmark') {
    const value = readJson(path);
    const findBookmark = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return null;
      for (const [key, child] of Object.entries(candidate)) {
        if (key.toLowerCase().includes('bookmark') && typeof child === 'string') return child;
        const nested = findBookmark(child);
        if (nested) return nested;
      }
      return null;
    };
    const bookmark = findBookmark(value);
    if (!bookmark) throw new Error('Wrangler did not return a Time Travel bookmark.');
    appendSummary(['### D1 recovery point', `- bookmark: \`${bookmark}\``]);
  } else if (command === 'counts') {
    const counts = inspectCounts(readJson(path));
    appendSummary([
      '### Production D1 aggregate counts',
      ...counts.map((entry) => `- ${entry.table}: ${entry.rows}`),
    ]);
  } else if (command === 'seasons') {
    const rows = inspectServiceSeasons(readJson(path));
    appendSummary([
      '### Service-season metadata',
      `- rows: ${rows.length}`,
      ...rows.map(
        (row) =>
          `- ${row.id}: ${row.status}, ${row.startsAt}–${row.endsAt ?? 'open-ended'}, ruleset ${row.rulesetVersion}, pack ${row.contentPackVersion}, test=${row.isTest}`,
      ),
    ]);
  } else if (command === 'plan') {
    const proposal = validateProposal({
      startsAt: process.env.SEASON_STARTS_AT,
      endsAt: process.env.SEASON_ENDS_AT,
      challengeSetId: process.env.CHALLENGE_SET_ID,
    });
    const decision = decideSeason(inspectServiceSeasons(readJson(path)), proposal);
    if (decision.sql) writeFileSync(process.env.SEASON_SQL_PATH, decision.sql, { mode: 0o600 });
    if (decision.rollbackSql && process.env.SEASON_ROLLBACK_SQL_PATH)
      writeFileSync(process.env.SEASON_ROLLBACK_SQL_PATH, decision.rollbackSql, { mode: 0o600 });
    appendSummary([
      `### Season write plan`,
      `- action: ${decision.action}`,
      `- id: ${proposal.id}`,
      `- period: ${proposal.startsAt}–${proposal.endsAt ?? 'open-ended'}`,
    ]);
    process.stdout.write(decision.action);
  } else if (command === 'plan-end') {
    const proposal = validateProposal({
      startsAt: process.env.SEASON_STARTS_AT,
      endsAt: process.env.SEASON_ENDS_AT,
      challengeSetId: process.env.CHALLENGE_SET_ID,
    });
    const decision = decideSeasonEnd(inspectServiceSeasons(readJson(path)), proposal);
    if (decision.sql) writeFileSync(process.env.SEASON_SQL_PATH, decision.sql, { mode: 0o600 });
    appendSummary([
      '### Season end-date write plan',
      `- action: ${decision.action}`,
      `- ends at: ${proposal.endsAt ?? 'open-ended'}`,
    ]);
    process.stdout.write(decision.action);
  } else if (command === 'expect-version') {
    // 워크플로 verify 단계가 기대 manifest를 여기서 읽는다(하드코딩 중복 방지).
    process.stdout.write(
      JSON.stringify({
        rulesetVersion: PRODUCTION_SEASON.rulesetVersion,
        contentPackVersion: PRODUCTION_SEASON.contentPackVersion,
      }),
    );
  } else if (command === 'proposal') {
    const proposal = validateProposal(
      {
        startsAt: process.env.SEASON_STARTS_AT,
        endsAt: process.env.SEASON_ENDS_AT,
        challengeSetId: process.env.CHALLENGE_SET_ID,
      },
      { required: process.env.REQUIRE_PROPOSAL === 'true' },
    );
    appendSummary([
      `### Release proposal`,
      proposal
        ? `- ${proposal.id}: ${proposal.startsAt}–${proposal.endsAt ?? 'open-ended'}, ${proposal.rulesetVersion}/${proposal.contentPackVersion}, test=${proposal.isTest}`
        : '- season period pending; deploy mode is blocked',
    ]);
  } else {
    throw new Error(
      'Usage: production-release.mjs bookmark|schema|counts|seasons|plan|plan-end|proposal|expect-version [wrangler-json]',
    );
  }
}
