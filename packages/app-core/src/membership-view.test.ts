import { describe, expect, it } from 'vitest';
import { memberPerks, memberStatusText, memberTenureView } from './membership-view';
import { supporterPill } from './supporter';
import { tenureGiftLines } from './attendance-view';

describe('T-11-512 클럽 멤버십 화면', () => {
  it('혜택은 출석 2배 · 매일 강화권 · 광고 제거 · 서포터 뱃지 · 연속 구독 선물 다섯 가지다', () => {
    expect(memberPerks().map((p) => p.key)).toEqual(['attend', 'boost', 'ads', 'badge', 'tenure']);
  });

  it('T-11-818 서포터 뱃지는 단계별 글자를 쓰고, 단계가 없는 구독 중 응답은 1단계로 본다', () => {
    expect(supporterPill(undefined)).toBeNull();
    expect(supporterPill(null, true)).toMatchObject({ tier: 1, text: '서포터' });
    expect(supporterPill(6)).toMatchObject({ tier: 6, text: '서포터 6개월' });
    expect(supporterPill(9)?.label).toBe('클럽 멤버십 9개월 연속 서포터');
  });

  it('T-11-818 이용 중 띠는 연속 개월 · 다음 선물을, 출석 카드는 받은 개월 선물을 보인다', () => {
    expect(memberTenureView({ active: false })).toBeNull();
    expect(
      memberTenureView({
        active: true,
        months: 2,
        supporter: 1,
        nextGift: { months: 3, boost: 3, scout: 1 },
      }),
    ).toMatchObject({
      pill: { tier: 1 },
      streak: '연속 2개월째 구독하고 있어요',
      next: '3개월째 선물 · 잠재력 강화권 3장, 프리미엄 스카우트권 1장',
    });
    expect(tenureGiftLines([{ months: 2, boost: 2, scout: 0 }])).toEqual([
      '연속 2개월 선물 · 잠재력 강화권 2장',
    ]);
    expect(tenureGiftLines(undefined)).toEqual([]);
  });

  it('자동 결제 여부에 맞춰 상태 한 줄을 고른다', () => {
    const until = '2026-12-01T03:00:00.000Z';
    expect(memberStatusText({ active: false, until: null, autoRenew: null })).toBeNull();
    expect(memberStatusText({ active: true, until, autoRenew: true })).toMatch(
      /다음 달 요금이 결제돼요/,
    );
    expect(memberStatusText({ active: true, until, autoRenew: false })).toMatch(
      /자동 결제를 껐어요/,
    );
    expect(memberStatusText({ active: true, until, autoRenew: null })).toMatch(
      /까지 혜택을 받아요/,
    );
    expect(memberStatusText({ active: false, until, autoRenew: false })).toMatch(
      /멤버십이 끝났어요/,
    );
  });
});
