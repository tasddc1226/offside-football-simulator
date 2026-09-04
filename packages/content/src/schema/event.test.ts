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
              {
                kind: 'PERMANENT',
                sourceId: 'EVT-DEV-001.A.A1',
                target: 'crossing',
                delta: 1,
                ...EFFECT_DEFAULTS.PERMANENT,
              },
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
    (event as { choices: unknown[] }).choices = [
      ...choices,
      { ...choices[1], id: 'C' },
      { ...choices[1], id: 'D' },
    ];
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

// T-4-001 D-52: presentation이 INJURY/NATIONAL_TEAM인 이벤트는 choices마다 rehabPlan/callUp이 정확히
// 그 짝일 때만 통과한다(4가지 부정 케이스).
describe('EventDefinitionSchema — presentation과 rehabPlan/callUp 짝(T-4-001 D-52)', () => {
  it('presentation이 INJURY인데 choice에 rehabPlan이 없으면 거부한다', () => {
    const event = baseEvent({ presentation: 'INJURY' });
    expect(() => EventDefinitionSchema.parse(event)).toThrow(/rehabPlan이 필요하다/);
  });

  it('presentation이 INJURY인데 choice에 callUp이 있으면 거부한다', () => {
    const event = baseEvent();
    const choices = (event as { choices: Record<string, unknown>[] }).choices;
    choices[0]!.rehabPlan = 'STANDARD';
    choices[0]!.callUp = 'ACCEPT';
    choices[1]!.rehabPlan = 'STANDARD';
    (event as Record<string, unknown>).presentation = 'INJURY';
    expect(() => EventDefinitionSchema.parse(event)).toThrow(/callUp을 쓸 수 없다/);
  });

  it('presentation이 NATIONAL_TEAM인데 choice에 callUp이 없으면 거부한다', () => {
    const event = baseEvent({ presentation: 'NATIONAL_TEAM' });
    expect(() => EventDefinitionSchema.parse(event)).toThrow(/callUp이 필요하다/);
  });

  it('presentation이 NATIONAL_TEAM인데 choice에 rehabPlan이 있으면 거부한다', () => {
    const event = baseEvent();
    const choices = (event as { choices: Record<string, unknown>[] }).choices;
    choices[0]!.callUp = 'ACCEPT';
    choices[0]!.rehabPlan = 'STANDARD';
    choices[1]!.callUp = 'ACCEPT';
    (event as Record<string, unknown>).presentation = 'NATIONAL_TEAM';
    expect(() => EventDefinitionSchema.parse(event)).toThrow(/rehabPlan을 쓸 수 없다/);
  });
});

describe('EventDefinitionSchema — presentation FAIL safety (T-4-003 P4-6)', () => {
  function failPresentationEvent(effect: Record<string, unknown>, followUps?: unknown[]) {
    const event = baseEvent({ presentation: 'ETHICS' });
    const choices = (event as { choices: Record<string, unknown>[] }).choices;
    for (const choice of choices) {
      const outcomes = choice.outcomes as Record<string, unknown>[];
      outcomes[0] = {
        ...outcomes[0],
        kind: 'FAIL',
        effects: [effect],
        ...(followUps === undefined ? {} : { followUps }),
      };
    }
    return event;
  }

  it('followUp이 있어도 PERMANENT 음수 효과는 거부한다', () => {
    const event = failPresentationEvent(
      {
        kind: 'PERMANENT',
        sourceId: 'EVT-DEV-001.A.A1',
        target: 'crossing',
        delta: -1,
        ...EFFECT_DEFAULTS.PERMANENT,
      },
      [{ eventId: 'EVT-DEV-001' }],
    );
    expect(() => EventDefinitionSchema.parse(event)).toThrow(/PERMANENT 음수/);
  });

  it('followUp이 있으면 음수 CURRENT/CONTEXT의 유한 만료를 요구하지 않는다', () => {
    const event = failPresentationEvent(
      {
        kind: 'CURRENT',
        sourceId: 'EVT-DEV-001.A.A1',
        target: 'form',
        delta: -1,
        ...EFFECT_DEFAULTS.CURRENT,
        expiresAt: null,
      },
      [{ eventId: 'EVT-DEV-001' }],
    );
    expect(() => EventDefinitionSchema.parse(event)).not.toThrow();
  });

  it('followUp이 없는 음수 CURRENT/CONTEXT는 유한 만료가 없으면 거부한다', () => {
    const event = failPresentationEvent({
      kind: 'CURRENT',
      sourceId: 'EVT-DEV-001.A.A1',
      target: 'form',
      delta: -1,
      ...EFFECT_DEFAULTS.CURRENT,
      expiresAt: null,
    });
    expect(() => EventDefinitionSchema.parse(event)).toThrow(/회복 경로/);
  });
});
