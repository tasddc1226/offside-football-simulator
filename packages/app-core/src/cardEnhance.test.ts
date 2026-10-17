import { DEFAULT_ENHANCE_RULES } from '@offside/contracts/card-enhance';
import { describe, expect, it } from 'vitest';
import { enhanceBadge, enhanceErrorText, enhanceResultText, enhanceView } from './cardEnhance';
import { fairnessView } from './fairness';
import { slotBoosts } from './teamOwner';
import { tickerItems } from './ticker';

const R = DEFAULT_ENHANCE_RULES;

describe('카드 강화 창 (T-11-373)', () => {
  it('강화 전 카드: +0 → +1, 100%, 5억, 실패해도 그대로', () => {
    const v = enhanceView({}, R, 1_000_000, 0);
    expect(v).toMatchObject({ level: 0, next: 1, ratePct: '100%', cost: 50_000, block: null });
    expect(v.failText).toBe('실패해도 단계는 그대로예요.');
    expect(v.leftText).toBe('오늘 30번 더 할 수 있어요');
  });

  it('+6 도전은 실패하면 내려가고, 연속 실패는 확률을 올린다', () => {
    const v = enhanceView({ enhance: 6, enhanceFails: 2 }, R, 10_000_000, 3);
    expect(v.ratePct).toBe('60%');
    expect(v.failText).toBe('실패하면 +5 단계로 내려가요.');
    expect(v.pityText).toContain('2번');
  });

  it('막는 이유: 최고 단계 · 닫힘 · 판매 등록 · 한도 · 잔액', () => {
    expect(enhanceView({ enhance: 10 }, R, 1e9, 0).block).toBe('가장 높은 단계예요.');
    expect(enhanceView({}, { ...R, dailyCap: 0 }, 1e9, 0).block).toBe(
      '지금은 카드 강화를 쉬고 있어요.',
    );
    expect(enhanceView({}, R, 1e9, 0, true).block).toBe('판매 등록 중인 선수는 강화할 수 없어요.');
    expect(enhanceView({}, R, 1e9, 30).block).toBe('오늘 강화 횟수를 다 썼어요.');
    expect(enhanceView({}, R, 10, 0).block).toBe('구단 자금이 모자라요.');
  });

  it('결과 · 오류 문구와 배지', () => {
    expect(enhanceResultText({ success: true, from: 2, to: 3 })).toBe('+3 강화에 성공했어요.');
    expect(enhanceResultText({ success: false, from: 7, to: 6 })).toContain('+6 단계로 내려갔어요');
    expect(enhanceResultText({ success: false, from: 3, to: 3 })).toContain('+3 그대로');
    expect(enhanceErrorText({ reason: 'FUNDS_SHORT' })).toBe('구단 자금이 모자라요.');
    expect(enhanceErrorText({ reason: 'X', message: '서버 문구' })).toBe('서버 문구');
    expect(enhanceBadge(0)).toBeNull();
    expect(enhanceBadge(8)).toBe('+8');
  });

  it('줄 힘 보정은 강화 단계 × 배율이고, 빈 자리는 0', () => {
    const byId = new Map([
      ['a', { enhance: 10 }],
      ['b', {}],
    ]);
    expect(slotBoosts(['a', 'b', null], byId)).toEqual([1.6, 0, 0]);
    expect(slotBoosts(['a'], byId, 0)).toEqual([0]);
  });

  it('확률 도감 표는 열 단계이고 +7 도전부터 내려간다', () => {
    const v = fairnessView();
    expect(v.enhance).toHaveLength(10);
    expect(v.enhance[0]).toEqual(['+0 → +1', '100.0%', expect.any(String), '그대로']);
    expect(v.enhance[6]![3]).toBe('+5 단계로');
    expect(v.enhanceNote).toContain('10%');
  });

  it('전광판은 강화 성공을 기록 자리에 섞는다(옛 서버 응답엔 없음)', () => {
    const items = tickerItems({
      transfers: [],
      firsts: [],
      enhances: [
        { at: '2026-10-18T00:00:00.000Z', name: '강화왕', pos: 'FW', number: 9, level: 9 },
      ],
    });
    expect(items).toMatchObject([{ kind: 'enhance', who: '강화왕', text: '+9 강화 성공' }]);
    expect(tickerItems({ transfers: [], firsts: [] })).toEqual([]);
  });
});
