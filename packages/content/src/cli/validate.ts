#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPack } from './load-pack.ts';
import { validatePack } from './validate-pack.ts';
import { loadRulesetDir } from './load-ruleset-dir.ts';
import { validateRulesetDir } from './validate-ruleset.ts';
import { canonicalStringify } from './canonical-json.ts';
import {
  isRegisteredLegacyPopulationProvenance,
  LegacyPopulationSchema,
  PopulationManifestSchema,
} from '../legacy/population-schema.ts';

function parseArgs(argv: string[]): { pack?: string | undefined; writeChecksum: boolean } {
  let pack: string | undefined;
  let writeChecksum = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pack') {
      pack = argv[i + 1];
      i += 1;
    } else if (arg === '--write-checksum') {
      writeChecksum = true;
    }
  }

  return { pack, writeChecksum };
}

function listVersionDirs(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalChecksum(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function validateLegacyArtifacts(packageRoot: string): string[] {
  const legacyRoot = join(packageRoot, 'legacy');
  if (!existsSync(legacyRoot)) return [];
  const validated: string[] = [];
  for (const version of listVersionDirs(legacyRoot)) {
    const base = join(legacyRoot, version);
    const population = LegacyPopulationSchema.parse(
      JSON.parse(readFileSync(join(base, 'reference-population.json'), 'utf8')),
    );
    const manifest = PopulationManifestSchema.parse(
      JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8')),
    );
    if (version !== manifest.provenance.legacyVersion)
      throw new Error(`Legacy ${version} directory/version mismatch`);
    const rulesetManifest = JSON.parse(
      readFileSync(join(packageRoot, 'rulesets', manifest.provenance.rulesetVersion, 'manifest.json'), 'utf8'),
    );
    const packManifest = JSON.parse(
      readFileSync(join(packageRoot, 'packs', manifest.provenance.contentPackVersion, 'manifest.json'), 'utf8'),
    );
    const provenance = manifest.provenance;
    const isLegacyV3 =
      provenance.protocolVersion === 'phase5-population-3-ui-choices' &&
      provenance.choicePolicy === 'ui-action-strata-v1' &&
      provenance.rulesetVersion === '1.0.0';
    const expectedId = isLegacyV3
      ? `phase5-reference-${provenance.legacyVersion}-1.0.0-0.3.0`
      : `phase5-reference-${provenance.legacyVersion}-${provenance.rulesetVersion}-${provenance.contentPackVersion}-${provenance.choicePolicy}-${canonicalChecksum(provenance)}`;
    if (
      !isRegisteredLegacyPopulationProvenance(provenance) ||
      population.id !== expectedId ||
      population.legacyVersion !== manifest.provenance.legacyVersion ||
      population.rulesetVersion !== manifest.provenance.rulesetVersion ||
      canonicalChecksum(population) !== manifest.populationChecksum ||
      manifest.provenance.artifacts.rulesetChecksum !== rulesetManifest.checksum ||
      manifest.provenance.artifacts.contentPackChecksum !== packManifest.checksum ||
      new Set(manifest.groups.map((group) => group.position)).size !== 4
    )
      throw new Error(`Legacy ${version} compact population integrity mismatch`);
    if (
      sha256(readFileSync(join(base, 'evidence.json.gz'))) !== manifest.evidenceGzipChecksum ||
      sha256(readFileSync(join(base, 'generator.mjs.gz'))) !==
        manifest.generatorBundleGzipChecksum
    )
      throw new Error(`Legacy ${version} retained evidence checksum mismatch`);
    validated.push(version);
  }
  return validated;
}

function main(): void {
  const { pack, writeChecksum } = parseArgs(process.argv.slice(2));
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const packsRoot = join(packageRoot, 'packs');
  const rulesetsRoot = join(packageRoot, 'rulesets');
  const legacyVersions = validateLegacyArtifacts(packageRoot);

  const packVersions = pack ? [pack] : listVersionDirs(packsRoot);
  const rulesetVersions = listVersionDirs(rulesetsRoot);

  let totalEvents = 0;
  let totalWarnings = 0;
  const allErrors: string[] = [];
  const checksumLines: string[] = [];

  for (const version of packVersions) {
    const dir = join(packsRoot, version);
    const loaded = loadPack(dir);
    const result = validatePack(loaded, { writeChecksum });

    if (writeChecksum && result.manifest) {
      const nextManifest = { ...result.manifest, checksum: result.computedChecksum };
      writeFileSync(loaded.manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    }

    for (const warning of result.warnings) console.error(`WARN [pack ${version}] ${warning}`);
    for (const error of result.errors) allErrors.push(`[pack ${version}] ${error}`);

    totalEvents += result.eventCount;
    totalWarnings += result.warnings.length;
    checksumLines.push(`pack ${version} checksum=${result.computedChecksum}`);
  }

  for (const version of rulesetVersions) {
    const dir = join(rulesetsRoot, version);
    const loaded = loadRulesetDir(dir);
    const result = validateRulesetDir(loaded, { writeChecksum });

    if (writeChecksum && result.manifest) {
      const nextManifest = { ...result.manifest, checksum: result.computedChecksum };
      writeFileSync(loaded.manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    }

    for (const error of result.errors) allErrors.push(`[ruleset ${version}] ${error}`);
    checksumLines.push(`ruleset ${version} checksum=${result.computedChecksum}`);
  }

  if (allErrors.length > 0) {
    for (const error of allErrors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
    return;
  }

  for (const line of checksumLines) console.log(line);
  for (const version of legacyVersions) console.log(`legacy ${version} reference population verified`);

  const label = pack ?? packVersions.join(',');
  console.log(`content:validate OK (${label} events=${totalEvents} warnings=${totalWarnings})`);
}

main();
