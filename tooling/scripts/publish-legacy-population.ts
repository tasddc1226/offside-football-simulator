import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';
import {
  legacyPolicyForVersion,
  type LegacyVersion,
} from '../../packages/domain/src/legacy/result.ts';
import { validateLegacyPopulation } from '../../packages/content/src/legacy/validate-population.ts';
import rulesetManifest from '../../packages/content/rulesets/1.0.0/manifest.json' with { type: 'json' };
import packManifest from '../../packages/content/packs/0.3.0/manifest.json' with { type: 'json' };

// Offline release tool: does not simulate, change scores, or publish to a remote service.
const input = process.argv[2];
const bundlePath = process.argv[3];
if (!input || !bundlePath)
  throw new Error(
    'Usage: tsx publish-legacy-population.ts <verified-report.json> <frozen-bundle.mjs>',
  );
const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const canonicalHash = (value: unknown) => digest(canonicalize(value as JsonValue));
const report = JSON.parse(await readFile(input, 'utf8'));
const { population, provenance, groups } = report;
if (
  provenance.protocolVersion !== 'phase5-population-3-ui-choices' ||
  provenance.choicePolicy !== 'ui-action-strata-v1' ||
  (provenance.legacyVersion !== '1.0.0' && provenance.legacyVersion !== '1.1.0') ||
  population.legacyVersion !== provenance.legacyVersion ||
  population.id !== `phase5-reference-${provenance.legacyVersion}-1.0.0-0.3.0` ||
  provenance.contentPackVersion !== '0.3.0' ||
  provenance.rulesetVersion !== '1.0.0'
)
  throw new Error('Not a registered-content population protocol');
if (
  report.kind !== 'REFERENCE_POPULATION' ||
  report.populationHash !== canonicalHash({ population, provenance, groups })
)
  throw new Error('Unverified or incomplete population report');
if (
  provenance.countPerPosition !== 10000 ||
  provenance.maxSeasons !== 20 ||
  provenance.policyChecksum !==
    canonicalHash(legacyPolicyForVersion(provenance.legacyVersion as LegacyVersion))
)
  throw new Error('Wrong population policy/count');
const positions = ['GK', 'DF', 'MF', 'FW'];
const bandForScore = (score: number) =>
  score >= 90
    ? 'BAND-LEGEND'
    : score >= 75
      ? 'BAND-ICON'
      : score >= 50
        ? 'BAND-REMEMBERED'
        : score >= 25
          ? 'BAND-SOLID'
          : 'BAND-COMPLETE';
if (groups.map((group: { position: string }) => group.position).join(',') !== positions.join(','))
  throw new Error('Wrong groups');
for (const group of groups) {
  if (group.rows.length !== 10000 || group.hash !== canonicalHash(group.rows))
    throw new Error('Invalid evidence group');
  for (const [index, row] of group.rows.entries()) {
    if (
      row.position !== group.position ||
      row.seedIndex !== index ||
      row.seed !== `phase5-population:${group.position}:${index}` ||
      row.requestedSeasons !== 1 + (index % 20) ||
      !Number.isInteger(row.seasons) ||
      row.seasons < 1 ||
      row.seasons > row.requestedSeasons ||
      !Number.isInteger(row.score) ||
      row.score < 0 ||
      row.score > 100 ||
      row.bandId !== bandForScore(row.score) ||
      !row.componentScores ||
      !Object.values(row.componentScores).every(
        (value: unknown) =>
          Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100,
      ) ||
      Math.floor(
        (row.componentScores.achievement * 30 +
          row.componentScores.contribution * 25 +
          row.componentScores.longevity * 15 +
          row.componentScores.relationship * 15 +
          row.componentScores.narrative * 15 +
          50) /
          100,
      ) !== row.score ||
      row.minutes < 0 ||
      row.possibleMinutes < 0 ||
      row.minutes > row.possibleMinutes ||
      !Number.isSafeInteger(row.minutes) ||
      !Number.isSafeInteger(row.possibleMinutes) ||
      !Number.isSafeInteger(row.peakOvr) ||
      !Number.isSafeInteger(row.trophies) ||
      !Array.isArray(row.endingCandidates) ||
      !/^[a-f0-9]{64}$/.test(row.archiveHash) ||
      !/^[a-f0-9]{64}$/.test(row.resultHash)
    )
      throw new Error('Invalid career evidence');
  }
  const scores = group.rows
    .map((row: { score: number }) => row.score)
    .sort((a: number, b: number) => a - b);
  if (JSON.stringify(scores) !== JSON.stringify(population.scores[group.position]))
    throw new Error('Evidence/scores mismatch');
}
const bundle = await readFile(bundlePath);
if (digest(bundle) !== provenance.generatorCodeHash)
  throw new Error('Wrong frozen generator bundle');
const evidence = gzipSync(JSON.stringify(report), { level: 9 });
const bundleGzip = gzipSync(bundle, { level: 9 });
const manifest = {
  kind: 'VERIFIED_LEGACY_REFERENCE',
  populationChecksum: canonicalHash(population),
  evidencePayloadHash: report.populationHash,
  evidenceGzipChecksum: digest(evidence),
  generatorBundleGzipChecksum: digest(bundleGzip),
  provenance,
  groups: groups.map((group: { position: string; rows: unknown[]; hash: string }) => ({
    position: group.position,
    count: group.rows.length,
    hash: group.hash,
  })),
};
// The final compact runtime schema pins the actual registry, not just self-reported evidence.
validateLegacyPopulation(population, manifest, {
  rulesetChecksum: rulesetManifest.checksum,
  contentPackChecksum: packManifest.checksum,
});
async function immutableWrite(path: string, bytes: Uint8Array | string) {
  try {
    const existing = await readFile(path);
    if (!existing.equals(Buffer.from(bytes)))
      throw new Error(`Refusing to overwrite immutable artifact: ${path}`);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: 'wx' });
}
const base = resolve(`packages/content/legacy/${provenance.legacyVersion}`);
await immutableWrite(resolve(base, 'reference-population.json'), `${JSON.stringify(population)}\n`);
await immutableWrite(resolve(base, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await immutableWrite(resolve(base, 'evidence.json.gz'), evidence);
await immutableWrite(resolve(base, 'generator.mjs.gz'), bundleGzip);
console.log(
  JSON.stringify({
    base,
    populationChecksum: manifest.populationChecksum,
    evidenceBytes: evidence.length,
    generatorBytes: bundleGzip.length,
  }),
);
