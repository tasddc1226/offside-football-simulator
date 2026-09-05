/** Retain historical engine-stress evidence. This never creates a runtime reference artifact. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';

const [reportPath, bundlePath] = process.argv.slice(2);
if (!reportPath || !bundlePath) throw new Error('Require a complete v2 report and frozen bundle');
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const bundle = await readFile(bundlePath);
const { population, provenance, groups } = report;
if (
  report.kind !== 'REFERENCE_POPULATION' ||
  provenance.protocolVersion !== 'phase5-population-2-registered-choices' ||
  provenance.generatorCodeHash !== hash(bundle) ||
  report.populationHash !== hash(canonicalize({ population, provenance, groups } as JsonValue)) ||
  groups.length !== 4 ||
  groups.some((g: { rows: unknown[] }) => g.rows.length !== 10000)
)
  throw new Error('Incomplete or changed historical baseline');
const evidence = gzipSync(JSON.stringify(report), { level: 9 });
const generator = gzipSync(bundle, { level: 9 });
const manifest = {
  kind: 'ENGINE_STRESS_BASELINE_NOT_PLAYER_REFERENCE',
  reason: 'v2 samples KEEP declines that are not offered by the player UI',
  sourcePayloadHash: report.populationHash,
  generatorCodeHash: provenance.generatorCodeHash,
  evidenceGzipChecksum: hash(evidence),
  generatorGzipChecksum: hash(generator),
  groups: groups.map((g: { position: string; rows: Array<{ score: number }> }) => ({
    position: g.position,
    count: g.rows.length,
    maximumScore: Math.max(...g.rows.map((r) => r.score)),
    legend: g.rows.filter((r) => r.score >= 90).length,
    icon: g.rows.filter((r) => r.score >= 75 && r.score < 90).length,
    remembered: g.rows.filter((r) => r.score >= 50 && r.score < 75).length,
  })),
};
const output = resolve('docs/tracking/evidence/phase5-baseline-v2');
await mkdir(output, { recursive: true });
for (const [name, data] of [
  ['evidence.json.gz', evidence],
  ['generator.mjs.gz', generator],
  ['manifest.json', JSON.stringify(manifest, null, 2) + '\n'],
] as const)
  await writeFile(resolve(output, name), data, { flag: 'wx' });
console.log(
  JSON.stringify({
    output,
    evidenceBytes: evidence.length,
    generatorBytes: generator.length,
    manifest,
  }),
);
