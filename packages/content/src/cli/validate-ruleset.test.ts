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

// T-2-001 완료 조건: "룰셋 leagueCalendar 검증: 12 step, phase 순서, step 12 SETTLEMENT 필수.
// 잘못된 캘린더 3종이 로더에서 거부된다."
describe('validateRulesetDir (leagueCalendar 검증)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'offside-content-calendar-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeRuleset(content: unknown): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ruleset.json'), JSON.stringify(content, null, 2));
    const manifest = { version: (content as { version: string }).version, checksum: computeRulesetChecksum(content) };
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  it('step이 12개가 아니면 거부한다', () => {
    const invalid = structuredClone(ruleset100) as typeof ruleset100;
    invalid.leagueCalendar.steps.pop();
    writeRuleset(invalid);
    const result = validateRulesetDir(loadRulesetDir(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('ruleset.json') && e.includes('steps'))).toBe(true);
  });

  it('phase 순서가 되돌아가면 거부한다', () => {
    const invalid = structuredClone(ruleset100) as typeof ruleset100;
    // step 5(LEAGUE)를 SETTLEMENT로 바꿔 step 6(LEAGUE)보다 뒤로 가게 만든다.
    invalid.leagueCalendar.steps[4]!.phase = 'SETTLEMENT';
    writeRuleset(invalid);
    const result = validateRulesetDir(loadRulesetDir(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('ruleset.json') && e.includes('phase'))).toBe(true);
  });

  it('step 12에 필수 SETTLEMENT 슬롯이 없으면 거부한다', () => {
    const invalid = structuredClone(ruleset100) as typeof ruleset100;
    invalid.leagueCalendar.steps[11]!.slots = [{ kind: 'EVENT', required: false }];
    writeRuleset(invalid);
    const result = validateRulesetDir(loadRulesetDir(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('ruleset.json') && e.includes('SETTLEMENT'))).toBe(true);
  });
});
