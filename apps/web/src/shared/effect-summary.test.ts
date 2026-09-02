import { describe, expect, it } from 'vitest';
import type { Effect } from '@offside/domain';
import { formatEffectSummary } from './effect-summary.js';

function effect(overrides: Partial<Effect>): Effect {
  return {
    kind: 'CONTEXT',
    sourceId: 'src',
    target: 'tacticalFit',
    delta: 6,
    clamp: { min: 0, max: 100 },
    appliesAt: { kind: 'IMMEDIATE' },
    expiresAt: null,
    stackingRule: 'ONCE_PER_SOURCE',
    ...overrides,
  };
}

describe('formatEffectSummary', () => {
  it('NEXT_SEASON_STEP 적용은 "다음 시즌 N단계부터"를 붙인다', () => {
    const result = formatEffectSummary(
      effect({ kind: 'DEFERRED', target: 'tacticalFit', delta: 6, appliesAt: { kind: 'NEXT_SEASON_STEP', step: 1 } }),
    );
    expect(result).toBe('전술 적합도 +6(다음 시즌 1단계부터)');
  });

  it('STEPS_AFTER 만료는 "N스텝 동안"을 붙인다', () => {
    const result = formatEffectSummary(
      effect({ kind: 'CURRENT', target: 'form', delta: 5, expiresAt: { kind: 'STEPS_AFTER', steps: 2 } }),
    );
    expect(result).toBe('폼 +5(2스텝 동안)');
  });

  it('즉시·무기한 적용은 시점 문구를 붙이지 않는다', () => {
    const result = formatEffectSummary(effect({ kind: 'RELATION', target: 'managerTrust', delta: 5 }));
    expect(result).toBe('감독 신뢰 +5');
  });

  it('음수 delta는 부호를 그대로 표시한다', () => {
    const result = formatEffectSummary(effect({ target: 'squadStatus', delta: -4 }));
    expect(result).toBe('스쿼드 상태 -4');
  });

  it('라벨이 없는 target은 원문 target을 그대로 쓴다', () => {
    const result = formatEffectSummary(effect({ target: 'unknownTarget', delta: 1 }));
    expect(result).toBe('unknownTarget +1');
  });
});
