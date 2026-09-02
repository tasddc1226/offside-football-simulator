import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadRulesetDir } from './load-ruleset-dir.ts';
import { validateRulesetDir } from './validate-ruleset.ts';
import { computeRulesetChecksum } from './checksum.ts';
import ruleset100 from '../../rulesets/1.0.0/ruleset.json' with { type: 'json' };

const RULESET_1_0_0_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rulesets', '1.0.0');

function writeRulesetFixture(dir: string, options: { version?: string; checksum?: string } = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ruleset.json'), JSON.stringify(ruleset100, null, 2));
  const checksum = options.checksum ?? computeRulesetChecksum(ruleset100);
  const manifest = { version: options.version ?? ruleset100.version, checksum };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

describe('validateRulesetDir (real ruleset 1.0.0)', () => {
  it('passes for the shipped ruleset 1.0.0 directory', () => {
    const result = validateRulesetDir(loadRulesetDir(RULESET_1_0_0_DIR), { writeChecksum: false });
    expect(result.errors).toEqual([]);
  });
});

describe('validateRulesetDir (fixtures)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'offside-content-ruleset-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes for a well-formed ruleset directory', () => {
    writeRulesetFixture(dir);
    const result = validateRulesetDir(loadRulesetDir(dir), { writeChecksum: false });
    expect(result.errors).toEqual([]);
  });

  it('detects a checksum mismatch against manifest.json', () => {
    writeRulesetFixture(dir, { checksum: '0'.repeat(64) });
    const result = validateRulesetDir(loadRulesetDir(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('checksum'))).toBe(true);
  });

  it('skips checksum comparison when writeChecksum is true', () => {
    writeRulesetFixture(dir, { checksum: '0'.repeat(64) });
    const result = validateRulesetDir(loadRulesetDir(dir), { writeChecksum: true });
    expect(result.errors.some((e) => e.includes('checksum'))).toBe(false);
    expect(result.computedChecksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects a version mismatch between manifest.json and ruleset.json', () => {
    writeRulesetFixture(dir, { version: '9.9.9', checksum: computeRulesetChecksum(ruleset100) });
    const result = validateRulesetDir(loadRulesetDir(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });
});
