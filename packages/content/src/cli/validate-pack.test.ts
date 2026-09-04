import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadPack } from './load-pack.ts';
import { checkPresentationFailSafety, validatePack } from './validate-pack.ts';
import { computePackChecksum } from './checksum.ts';
import { EFFECT_DEFAULTS } from '../schema/effect.ts';
import type { EventDefinition } from '../schema/event.ts';

function minimalEvent(id: string, followUpEventId?: string) {
  return {
    id,
    version: 1,
    phases: ['YOUTH'],
    triggers: { eq: ['season.step', 1] },
    exclusionTags: [],
    weight: 10,
    safety: { minorSafe: true },
    cooldown: { seasons: 1 },
    choices: [
      {
        id: 'A',
        label: 'A 선택',
        riskLabel: 'LOW',
        previewEffects: [{ label: '미리보기' }],
        outcomes: [
          {
            id: 'A1',
            kind: 'SUCCESS',
            weight: 100,
            title: '성공',
            effects: [
              {
                kind: 'PERMANENT',
                sourceId: `${id}.A.A1`,
                target: 'crossing',
                delta: 1,
                ...EFFECT_DEFAULTS.PERMANENT,
              },
            ],
            ...(followUpEventId ? { followUps: [{ eventId: followUpEventId }] } : {}),
          },
        ],
      },
      {
        id: 'B',
        label: 'B 선택',
        riskLabel: 'MEDIUM',
        previewEffects: [{ label: '미리보기2' }],
        outcomes: [{ id: 'B1', kind: 'FAIL', weight: 100, title: '실패', effects: [] }],
      },
    ],
    narrative: { situation: '상황 설명' },
  };
}

const NARRATIVE_TOKENS = {
  name: ['김서준'],
  club: ['한강 FC'],
  manager: ['정우성'],
  rival: ['이도현'],
  captain: ['박준서'],
  team: ['한강 FC U18'],
  agent: ['하지훈'],
  delta: [],
};

function writePackFixture(
  dir: string,
  options: { events: Record<string, unknown>[]; checksum?: string; filesOverride?: string[] },
): void {
  mkdirSync(join(dir, 'events'), { recursive: true });
  mkdirSync(join(dir, 'narrative'), { recursive: true });

  for (const event of options.events) {
    writeFileSync(
      join(dir, 'events', `${(event as { id: string }).id}.json`),
      JSON.stringify(event, null, 2),
    );
  }
  writeFileSync(join(dir, 'narrative', 'tokens.json'), JSON.stringify(NARRATIVE_TOKENS, null, 2));

  const files = options.filesOverride ?? [
    ...options.events.map((e) => `events/${(e as { id: string }).id}.json`).sort(),
    'narrative/tokens.json',
  ];

  const fileContents = new Map<string, unknown>();
  for (const event of options.events)
    fileContents.set(`events/${(event as { id: string }).id}.json`, event);
  fileContents.set('narrative/tokens.json', NARRATIVE_TOKENS);

  const checksum = options.checksum ?? computePackChecksum(files, fileContents);

  const manifest = {
    contentPackVersion: '0.1.0',
    compatibleRulesetVersions: ['0.1.0'],
    clientMinVersion: '0.1.0',
    playtested: false,
    checksum,
    files,
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

describe('validatePack (fixtures)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'offside-content-pack-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes for a well-formed pack', () => {
    writePackFixture(dir, { events: [minimalEvent('EVT-DEV-001')] });
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.errors).toEqual([]);
    expect(result.eventCount).toBe(1);
  });

  it('detects duplicate ids', () => {
    const a = minimalEvent('EVT-DEV-001');
    mkdirSync(join(dir, 'events'), { recursive: true });
    mkdirSync(join(dir, 'narrative'), { recursive: true });
    writeFileSync(join(dir, 'events', 'EVT-DEV-001.json'), JSON.stringify(a));
    writeFileSync(join(dir, 'events', 'EVT-DEV-001-b.json'), JSON.stringify(a));
    writeFileSync(join(dir, 'narrative', 'tokens.json'), JSON.stringify(NARRATIVE_TOKENS));
    const files = ['events/EVT-DEV-001-b.json', 'events/EVT-DEV-001.json', 'narrative/tokens.json'];
    const fileContents = new Map<string, unknown>([
      ['events/EVT-DEV-001-b.json', a],
      ['events/EVT-DEV-001.json', a],
      ['narrative/tokens.json', NARRATIVE_TOKENS],
    ]);
    const checksum = computePackChecksum(files, fileContents);
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({
        contentPackVersion: '0.1.0',
        compatibleRulesetVersions: ['0.1.0'],
        clientMinVersion: '0.1.0',
        playtested: false,
        checksum,
        files,
      }),
    );

    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('id 중복'))).toBe(true);
  });

  it('detects a followUps.eventId that does not exist in the pack', () => {
    writePackFixture(dir, { events: [minimalEvent('EVT-DEV-001', 'EVT-DEV-999')] });
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('followUps.eventId가 팩에 없음'))).toBe(true);
  });

  it('detects a followUps cycle', () => {
    writePackFixture(dir, {
      events: [
        minimalEvent('EVT-DEV-001', 'EVT-DEV-002'),
        minimalEvent('EVT-DEV-002', 'EVT-DEV-001'),
      ],
    });
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('순환'))).toBe(true);
  });

  it('reports a missing file instead of throwing when manifest.files references a nonexistent file', () => {
    writePackFixture(dir, {
      events: [minimalEvent('EVT-DEV-001')],
      checksum: '0'.repeat(64),
      filesOverride: [
        'events/EVT-DEV-001.json',
        'events/EVT-DOES-NOT-EXIST.json',
        'narrative/tokens.json',
      ],
    });
    expect(() => validatePack(loadPack(dir), { writeChecksum: false })).not.toThrow();
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('목록에 있는 파일을 찾을 수 없다'))).toBe(true);
  });

  it('detects a checksum mismatch', () => {
    writePackFixture(dir, { events: [minimalEvent('EVT-DEV-001')], checksum: '0'.repeat(64) });
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.errors.some((e) => e.includes('checksum'))).toBe(true);
  });

  it('does not error on checksum mismatch when writeChecksum is requested, and the recomputed value can be written back', () => {
    writePackFixture(dir, { events: [minimalEvent('EVT-DEV-001')], checksum: '0'.repeat(64) });
    const loaded = loadPack(dir);
    const result = validatePack(loaded, { writeChecksum: true });
    expect(result.errors).toEqual([]);

    const nextManifest = { ...result.manifest, checksum: result.computedChecksum };
    writeFileSync(loaded.manifestPath, JSON.stringify(nextManifest, null, 2));

    const revalidated = validatePack(loadPack(dir), { writeChecksum: false });
    expect(revalidated.errors).toEqual([]);
    expect(JSON.parse(readFileSync(loaded.manifestPath, 'utf8')).checksum).toBe(
      result.computedChecksum,
    );
  });

  it('warns when weight >= 50 has no cooldown', () => {
    const event = minimalEvent('EVT-DEV-001');
    (event as { weight: number }).weight = 60;
    delete (event as { cooldown?: unknown }).cooldown;
    writePackFixture(dir, { events: [event] });
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.warnings.some((w) => w.includes('cooldown'))).toBe(true);
  });

  it('warns when outcome weights in a choice do not sum to 100', () => {
    const event = minimalEvent('EVT-DEV-001');
    const choice = (event as { choices: Record<string, unknown>[] }).choices[0] as Record<
      string,
      unknown
    >;
    const outcome = (choice.outcomes as Record<string, unknown>[])[0] as Record<string, unknown>;
    choice.outcomes = [{ ...outcome, weight: 40 }];
    writePackFixture(dir, { events: [event] });
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.warnings.some((w) => w.includes('weight 합'))).toBe(true);
  });

  it('warns when minorSafe is false and minAge is not set', () => {
    const event = minimalEvent('EVT-DEV-001');
    (event as { safety: Record<string, unknown> }).safety = { minorSafe: false };
    writePackFixture(dir, { events: [event] });
    const result = validatePack(loadPack(dir), { writeChecksum: false });
    expect(result.warnings.some((w) => w.includes('minorSafe'))).toBe(true);
  });

  it('presentation FAIL의 PERMANENT 음수는 followUp이 있어도 거부한다', () => {
    const event = minimalEvent('EVT-ETH-001') as {
      presentation?: string;
      choices: Array<{ outcomes: Array<Record<string, unknown>> }>;
    };
    event.presentation = 'ETHICS';
    for (const choice of event.choices) {
      choice.outcomes[0] = {
        ...choice.outcomes[0],
        kind: 'FAIL',
        effects: [
          {
            kind: 'PERMANENT',
            sourceId: 'EVT-ETH-001.A.A1',
            target: 'crossing',
            delta: -1,
            ...EFFECT_DEFAULTS.PERMANENT,
          },
        ],
        followUps: [{ eventId: 'EVT-ETH-001' }],
      };
    }
    const errors: string[] = [];
    checkPresentationFailSafety(
      [{ file: 'events/EVT-ETH-001.json', event: event as unknown as EventDefinition }],
      errors,
    );
    expect(errors.some((error) => error.includes('PERMANENT 음수'))).toBe(true);
  });

  it('presentation FAIL의 무기한 음수 CURRENT는 followUp 없이는 거부한다', () => {
    const event = minimalEvent('EVT-ETH-002') as {
      presentation?: string;
      choices: Array<{ outcomes: Array<Record<string, unknown>> }>;
    };
    event.presentation = 'ETHICS';
    for (const choice of event.choices) {
      choice.outcomes[0] = {
        ...choice.outcomes[0],
        kind: 'FAIL',
        effects: [
          {
            kind: 'CURRENT',
            sourceId: 'EVT-ETH-002.A.A1',
            target: 'form',
            delta: -1,
            ...EFFECT_DEFAULTS.CURRENT,
            expiresAt: null,
          },
        ],
      };
    }
    const errors: string[] = [];
    checkPresentationFailSafety(
      [{ file: 'events/EVT-ETH-002.json', event: event as unknown as EventDefinition }],
      errors,
    );
    expect(errors.some((error) => error.includes('회복 경로'))).toBe(true);
  });
});
