import { describe, expect, it } from 'vitest';
import { ChapterDefinitionSchema } from './chapter.ts';
import { EFFECT_DEFAULTS } from './effect.ts';

function baseChapter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'CHP-MATCH-001',
    version: 1,
    importance: 'MAJOR',
    trigger: { kind: 'DEBUT' },
    weight: 100,
    decisions: [
      {
        id: 'D1',
        prompt: '프로 데뷔전, 첫 플레이를 어떻게 시작할까?',
        options: [
          {
            id: 'SAFE',
            label: '안전한 첫 플레이',
            riskLabel: 'LOW',
            priorProbability: { successBp: 7000 },
            previewEffects: [{ label: '폼 소폭 상승' }],
            outcomes: [
              {
                id: 'SAFE-SUCCESS',
                kind: 'SUCCESS',
                weight: 70,
                title: '무난하게 첫 발을 뗐다',
                ratingDeltaTenths: 3,
                effects: [
                  { kind: 'CURRENT', sourceId: 'CHP-MATCH-001.D1.SAFE-SUCCESS.0', target: 'form', delta: 4, ...EFFECT_DEFAULTS.CURRENT },
                ],
                narrative: { situation: '실수 없이 첫 터치를 처리하자 벤치가 고개를 끄덕인다.' },
              },
              {
                id: 'SAFE-NEUTRAL',
                kind: 'NEUTRAL',
                weight: 30,
                title: '있는 듯 없는 듯 지나갔다',
                ratingDeltaTenths: 0,
                effects: [],
                narrative: { situation: '위험 부담 없이 지나갔지만 인상을 남기지는 못했다.' },
              },
            ],
          },
          {
            id: 'ROLE',
            label: '역할 수행',
            riskLabel: 'MEDIUM',
            priorProbability: { successBp: 5000 },
            previewEffects: [{ label: '감독 신뢰 변동' }],
            outcomes: [
              {
                id: 'ROLE-SUCCESS',
                kind: 'SUCCESS',
                weight: 50,
                title: '맡은 역할을 정확히 해냈다',
                ratingDeltaTenths: 6,
                effects: [
                  { kind: 'RELATION', sourceId: 'CHP-MATCH-001.D1.ROLE-SUCCESS.0', target: 'managerTrust', delta: 5, ...EFFECT_DEFAULTS.RELATION },
                ],
                narrative: { situation: '감독이 주문한 위치·타이밍을 그대로 실행하자 첫인상이 좋아졌다.' },
              },
              {
                id: 'ROLE-FAIL',
                kind: 'FAIL',
                weight: 50,
                title: '타이밍이 어긋났다',
                ratingDeltaTenths: -4,
                effects: [
                  { kind: 'RELATION', sourceId: 'CHP-MATCH-001.D1.ROLE-FAIL.0', target: 'managerTrust', delta: -3, ...EFFECT_DEFAULTS.RELATION },
                ],
                narrative: { situation: '지시받은 위치보다 반 박자 늦어 흐름이 끊겼다.' },
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ChapterDefinitionSchema', () => {
  it('parses a well-formed chapter', () => {
    expect(() => ChapterDefinitionSchema.parse(baseChapter())).not.toThrow();
  });

  it('rejects a decision with a single option', () => {
    const chapter = baseChapter();
    const decisions = (chapter as { decisions: Record<string, unknown>[] }).decisions;
    const decision = decisions[0] as Record<string, unknown>;
    const options = decision.options as unknown[];
    decision.options = [options[0]];
    expect(() => ChapterDefinitionSchema.parse(chapter)).toThrow();
  });

  it('rejects four decisions', () => {
    const chapter = baseChapter();
    const decisions = (chapter as { decisions: Record<string, unknown>[] }).decisions;
    const decision = decisions[0] as Record<string, unknown>;
    (chapter as { decisions: unknown[] }).decisions = [
      decision,
      { ...decision, id: 'D2' },
      { ...decision, id: 'D3' },
      { ...decision, id: 'D4' },
    ];
    expect(() => ChapterDefinitionSchema.parse(chapter)).toThrow();
  });

  it('rejects a CONTEXT effect (챕터는 CURRENT·RELATION·DEFERRED만 허용)', () => {
    const chapter = baseChapter();
    const decisions = (chapter as { decisions: Record<string, unknown>[] }).decisions;
    const decision = decisions[0] as Record<string, unknown>;
    const options = decision.options as Record<string, unknown>[];
    const option = options[0] as Record<string, unknown>;
    const outcomes = option.outcomes as Record<string, unknown>[];
    const outcome = outcomes[0] as Record<string, unknown>;
    outcome.effects = [
      {
        kind: 'CONTEXT',
        sourceId: 'CHP-MATCH-001.D1.SAFE-SUCCESS.0',
        target: 'tacticalFit',
        delta: 4,
        ...EFFECT_DEFAULTS.CONTEXT,
      },
    ];
    expect(() => ChapterDefinitionSchema.parse(chapter)).toThrow();
  });

  it('rejects priorProbability.successBp that mismatches actual SUCCESS weight by more than 500bp', () => {
    const chapter = baseChapter();
    const decisions = (chapter as { decisions: Record<string, unknown>[] }).decisions;
    const decision = decisions[0] as Record<string, unknown>;
    const options = decision.options as Record<string, unknown>[];
    const option = options[0] as Record<string, unknown>;
    // SAFE 옵션의 실제 SUCCESS 비중은 70%(7000bp)인데 priorProbability를 8000bp로 바꿔 ±500bp를 넘긴다.
    option.priorProbability = { successBp: 8000 };
    expect(() => ChapterDefinitionSchema.parse(chapter)).toThrow();
  });

  it('rejects ratingDeltaTenths: 20 (허용 범위 -15~15를 벗어남)', () => {
    const chapter = baseChapter();
    const decisions = (chapter as { decisions: Record<string, unknown>[] }).decisions;
    const decision = decisions[0] as Record<string, unknown>;
    const options = decision.options as Record<string, unknown>[];
    const option = options[0] as Record<string, unknown>;
    const outcomes = option.outcomes as Record<string, unknown>[];
    const outcome = outcomes[0] as Record<string, unknown>;
    outcome.ratingDeltaTenths = 20;
    expect(() => ChapterDefinitionSchema.parse(chapter)).toThrow();
  });

  it('rejects an id that does not match the CHP-MATCH-### pattern', () => {
    const chapter = baseChapter({ id: 'CHP-XYZ-001' });
    expect(() => ChapterDefinitionSchema.parse(chapter)).toThrow();
  });

  it('rejects a CURRENT/RELATION effect delta over ±12', () => {
    const chapter = baseChapter();
    const decisions = (chapter as { decisions: Record<string, unknown>[] }).decisions;
    const decision = decisions[0] as Record<string, unknown>;
    const options = decision.options as Record<string, unknown>[];
    const option = options[0] as Record<string, unknown>;
    const outcomes = option.outcomes as Record<string, unknown>[];
    const outcome = outcomes[0] as Record<string, unknown>;
    outcome.effects = [
      { kind: 'CURRENT', sourceId: 'CHP-MATCH-001.D1.SAFE-SUCCESS.0', target: 'form', delta: 13, ...EFFECT_DEFAULTS.CURRENT },
    ];
    expect(() => ChapterDefinitionSchema.parse(chapter)).toThrow();
  });
});
