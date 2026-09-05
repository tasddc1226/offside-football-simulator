/** Diagnostic only: replay a SHA-pinned baseline without modifying its frozen bundle.
 * Candidate numbers are experimental, never a runtime LegacyResult or reference population.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
const path = arg('--bundle');
const expectedHash = arg('--sha');
const output = arg('--out');
const count = Number(arg('--count', '20'));
if (!path || !expectedHash || !output || !Number.isSafeInteger(count) || count < 1 || count > 500)
  throw new Error('Require --bundle PATH --sha SHA256 --out PATH [--count 1..500 per group]');
const bytes = await readFile(path);
const sha = createHash('sha256').update(bytes).digest('hex');
if (sha !== expectedHash) throw new Error('Frozen bundle checksum mismatch');
let source = bytes.toString('utf8');
function replaceOnce(needle, replacement) {
  if (source.split(needle).length !== 2) throw new Error(`Ambiguous instrumentation: ${needle}`);
  source = source.replace(needle, replacement);
}
const uiKeep = args.includes('--ui-keep');
if (uiKeep) {
  replaceOnce(
    'const accept = !crossesGroup && chooseDeterministicIndex(seed, `role:${snapshot.revision}`, 2) === 0;',
    'const accept = pending.proposal.type === "KEEP" || (!crossesGroup && chooseDeterministicIndex(seed, `role:${snapshot.revision}`, 2) === 0);',
  );
}
replaceOnce(
  '  const result = createLegacyResult(archive, context);\n  return {',
  `
  const result = createLegacyResult(archive, context);
  const evidence = deriveLegacyEvidence(archive);
  const diagnostic = {
    componentScores: result.componentScores,
    facts: evidence.facts,
    tags: evidence.tags.map(id => ({ id, rarity: CAREER_TAGS[id].rarity })),
    finalRelationships: snapshot.state.relationships,
    seasons: evidence.state.seasonHistory.map(s => ({
      index: s.index,
      minutes: s.result.playerStats.minutes,
      possibleMinutes: s.result.selectionSummary.possibleMinutes,
      played: s.result.playerStats.appearances.total,
      performance: performance(s),
      fulfilled: s.result.promiseFulfilment.fulfilled,
      relationships: s.result.legacy?.relationships ?? { managerTrust: s.result.stateDeltas.managerTrust.after },
      baseOvr: s.result.baseOvr,
    })),
  };
  return {`,
);
replaceOnce('    finalChoice\n  };\n}', '    finalChoice,\n    diagnostic\n  };\n}');
replaceOnce('export {\n  main\n};', 'export { main, runCareer };');
const directory = await mkdtemp(join(tmpdir(), 'offside-balance-probe-'));
const instrumented = join(directory, 'instrumented.mjs');
await writeFile(instrumented, source, { flag: 'wx' });
const { runCareer } = await import(pathToFileURL(instrumented).href);
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const ratio = (a, b) => (b === 0 ? 0 : a / b);
const top = (values, n) => values.toSorted((a, b) => b - a).slice(0, n);
function candidate(row) {
  const d = row.diagnostic;
  const seasonContributions = d.seasons.map(
    (s) => 40 * ratio(s.minutes, s.possibleMinutes) + 0.5 * s.performance + (s.fulfilled ? 10 : 0),
  );
  // Breadth and prime: both use actual play, never OVR or population percentiles.
  const contribution = clamp(
    0.5 * mean(seasonContributions) + 0.5 * mean(top(seasonContributions, 5)),
  );
  // A full active season needs 60% exposure; service/zero-minute years earn no active tenure.
  const activeYears = d.seasons.reduce(
    (n, s) => n + Math.min(1, ratio(s.minutes, s.possibleMinutes) / 0.6),
    0,
  );
  const longevity = clamp(5 * activeYears);
  // Career impact through strongest two bonds is distinct from universal likeability.
  const bonds = d.seasons.map((s) =>
    mean(
      top(
        Object.entries(s.relationships)
          .filter(([key]) => key !== 'rival')
          .map(([, value]) => value),
        2,
      ),
    ),
  );
  const relationship = clamp(
    ((0.7 * mean(bonds)) / 70) * 100 + ((0.3 * mean(top(bonds, 3))) / 80) * 100,
  );
  const tagValues = { COMMON: 8, RARE: 20, EPIC: 35 };
  const narrative = clamp(d.tags.reduce((sum, tag) => sum + tagValues[tag.rarity], 0));
  const components = {
    achievement: d.componentScores.achievement,
    contribution,
    longevity,
    relationship,
    narrative,
  };
  const weights = {
    achievement: 30,
    contribution: 25,
    longevity: 15,
    relationship: 15,
    narrative: 15,
  };
  const total = Math.floor(
    (Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key], 0) + 50) /
      100,
  );
  return { components, total, activeYears };
}
const rows = [];
for (const position of ['GK', 'DF', 'MF', 'FW']) {
  for (let index = 0; index < count; index++) {
    const row = runCareer(position, index, 1 + (index % 20));
    rows.push({ ...row, candidate: candidate(row) });
  }
  console.log(JSON.stringify({ position, completed: count }));
}
const summary = ['GK', 'DF', 'MF', 'FW'].map((position) => {
  const group = rows.filter((row) => row.position === position);
  const scores = group.map((row) => row.candidate.total);
  return {
    position,
    n: group.length,
    baselineMean: mean(group.map((row) => row.score)),
    mean: mean(scores),
    max: Math.max(...scores),
    legend: scores.filter((n) => n >= 90).length,
    icon: scores.filter((n) => n >= 75 && n < 90).length,
    remembered: scores.filter((n) => n >= 50 && n < 75).length,
  };
});
await writeFile(
  resolve(output),
  JSON.stringify(
    {
      kind: 'EXPERIMENT_NOT_REFERENCE_POPULATION',
      frozenGeneratorSha256: sha,
      candidateId: 'prime-bonds-active-tenure-draft-1',
      uiKeep,
      summary,
      rows,
    },
    null,
    2,
  ),
  { flag: 'wx' },
);
console.log(JSON.stringify(summary));
