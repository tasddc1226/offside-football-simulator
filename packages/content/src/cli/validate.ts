#!/usr/bin/env node
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPack } from './load-pack.ts';
import { validatePack } from './validate-pack.ts';
import { loadRulesetDir } from './load-ruleset-dir.ts';
import { validateRulesetDir } from './validate-ruleset.ts';

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

function main(): void {
  const { pack, writeChecksum } = parseArgs(process.argv.slice(2));
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const packsRoot = join(packageRoot, 'packs');
  const rulesetsRoot = join(packageRoot, 'rulesets');

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

  const label = pack ?? packVersions.join(',');
  console.log(`content:validate OK (${label} events=${totalEvents} warnings=${totalWarnings})`);
}

main();
