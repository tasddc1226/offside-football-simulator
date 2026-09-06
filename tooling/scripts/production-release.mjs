import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_SEASON = Object.freeze({
  id: 'svc_season_1',
  name: '시즌 1',
  status: 'ACTIVE',
  rulesetVersion: '1.1.0',
  contentPackVersion: '0.3.0',
  isTest: 0,
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
  if (!input.startsAt || !input.endsAt || !input.challengeSetId) {
    throw new Error('startsAt, endsAt, and challengeSetId must be provided together.');
  }
  const startsAt = isoInstant(input.startsAt, 'startsAt');
  const endsAt = isoInstant(input.endsAt, 'endsAt');
  if (Date.parse(startsAt) >= Date.parse(endsAt))
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
  return rowsFromWrangler(json).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: String(row.status),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    rulesetVersion: String(row.ruleset_version),
    contentPackVersion: String(row.content_pack_version),
    challengeSetId: String(row.challenge_set_id),
    isTest: Number(row.is_test),
  }));
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
    if (!equal) throw new Error(`A different ACTIVE season already exists (${actual.id}).`);
    return { action: 'noop', sql: null };
  }
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const values = [
    proposal.id,
    proposal.name,
    proposal.status,
    proposal.startsAt,
    proposal.endsAt,
    proposal.rulesetVersion,
    proposal.contentPackVersion,
    proposal.challengeSetId,
    proposal.isTest,
  ]
    .map((value) => (typeof value === 'number' ? String(value) : quote(value)))
    .join(', ');
  return {
    action: 'insert',
    sql: `INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)\nSELECT ${values}\nWHERE NOT EXISTS (SELECT 1 FROM service_seasons WHERE status = 'ACTIVE')\n  AND NOT EXISTS (SELECT 1 FROM service_seasons WHERE id = ${quote(proposal.id)});\n`,
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
          `- ${row.id}: ${row.status}, ${row.startsAt}–${row.endsAt}, ruleset ${row.rulesetVersion}, pack ${row.contentPackVersion}, test=${row.isTest}`,
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
    appendSummary([
      `### Season write plan`,
      `- action: ${decision.action}`,
      `- id: ${proposal.id}`,
      `- period: ${proposal.startsAt}–${proposal.endsAt}`,
    ]);
    process.stdout.write(decision.action);
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
        ? `- ${proposal.id}: ${proposal.startsAt}–${proposal.endsAt}, ${proposal.rulesetVersion}/${proposal.contentPackVersion}, test=${proposal.isTest}`
        : '- season period pending; deploy mode is blocked',
    ]);
  } else {
    throw new Error(
      'Usage: production-release.mjs bookmark|schema|counts|seasons|plan|proposal [wrangler-json]',
    );
  }
}
