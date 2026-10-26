import { describe, expect, it } from 'vitest';
import { memberPerks, memberStatusText } from './membership-view';

describe('T-11-512 클럽 멤버십 화면', () => {
  it('혜택은 출석 2배 · 광고 제거 · 서포터 뱃지 세 가지다', () => {
    expect(memberPerks().map((p) => p.key)).toEqual(['attend', 'ads', 'badge']);
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
