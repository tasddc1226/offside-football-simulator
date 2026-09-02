import { describe, expect, it } from 'vitest';
import { EventDefinitionSchema } from './event.ts';
import { EFFECT_DEFAULTS } from './effect.ts';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'EVT-DEV-001',
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
        label: '감독 역할 맞추기',
        riskLabel: 'LOW',
        previewEffects: [{ label: '전술 적합도 상승' }],
        outcomes: [
          {
            id: 'A1',
            kind: 'SUCCESS',
            weight: 100,
            title: '성공',
            effects: [
              { kind: 'PERMANENT', sourceId: 'EVT-DEV-001.A.A1', target: 'crossing', delta: 1, ...EFFECT_DEFAULTS.PERMANENT },
            ],
          },
        ],
      },
      {
        id: 'B',
        label: '내 역할 갈고닦기',
        riskLabel: 'MEDIUM',
        previewEffects: [{ label: '결정력·드리블 성장' }],
        outcomes: [{ id: 'B1', kind: 'SUCCESS', weight: 100, title: '성공', effects: [] }],
      },
    ],
    narrative: { situation: '{manager} 감독이 부른다.' },
    ...overrides,
  };
}

describe('EventDefinitionSchema', () => {
  it('parses a well-formed event', () => {
    expect(() => EventDefinitionSchema.parse(baseEvent())).not.toThrow();
  });

  it('rejects a single choice', () => {
    const event = baseEvent();
    (event as { choices: unknown[] }).choices = [(event as { choices: unknown[] }).choices[0]];
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });

  it('rejects four choices', () => {
    const event = baseEvent();
    const choices = (event as { choices: Record<string, unknown>[] }).choices;
    (event as { choices: unknown[] }).choices = [...choices, { ...choices[1], id: 'C' }, { ...choices[1], id: 'D' }];
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });

  it('rejects weight: 0 on an outcome', () => {
    const event = baseEvent();
    const choices = (event as { choices: Record<string, unknown>[] }).choices;
    const firstChoice = choices[0] as Record<string, unknown>;
    const outcomes = firstChoice.outcomes as Record<string, unknown>[];
    firstChoice.outcomes = [{ ...outcomes[0], weight: 0 }];
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });

  it('rejects a narrative token with the particle pair in the wrong order', () => {
    const event = baseEvent({ narrative: { situation: '{club:와/과} 헤어진다' } });
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });

  it('rejects an unknown narrative token', () => {
    const event = baseEvent({ narrative: { situation: '{unknown} 등장' } });
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });

  it('rejects duplicate phases', () => {
    const event = baseEvent({ phases: ['YOUTH', 'YOUTH'] });
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });

  it('rejects a cooldown with neither steps nor seasons', () => {
    const event = baseEvent({ cooldown: {} });
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });

  it('rejects an id that does not match the EVT-<GROUP>-### pattern', () => {
    const event = baseEvent({ id: 'EVT-XYZ-001' });
    expect(() => EventDefinitionSchema.parse(event)).toThrow();
  });
});
