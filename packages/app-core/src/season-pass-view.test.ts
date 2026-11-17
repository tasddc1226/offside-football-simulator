import { describe, expect, it } from 'vitest';
import {
  passBuyNowText,
  passClaimable,
  passNext,
  passTiers,
  passTotalText,
  PASS_TIER_COUNT,
} from './season-pass-view';

const season = (over: Partial<Parameters<typeof passTiers>[0]> = {}) => ({
  season: 2,
  owned: true,
  progress: 5,
  tier: 5,
  claimed: 2,
  ...over,
});

describe('T-11-511 시즌 패스 화면', () => {
  it('단계표는 받은 단계 · 열린 단계 · 잠긴 단계로 나뉜다', () => {
    const tiers = passTiers(season());
    expect(tiers).toHaveLength(PASS_TIER_COUNT);
    expect(tiers.map((t) => t.state).slice(0, 6)).toEqual([
      'claimed',
      'claimed',
      'open',
      'open',
      'open',
      'locked',
    ]);
    // T-11-519 1단계는 사면 바로, 은퇴 30명부터는 보너스 단계다.
    expect(tiers[0]).toMatchObject({ tier: 1, need: 0, kind: 'now' });
    expect(tiers[1]).toMatchObject({ tier: 2, need: 1, kind: 'base', reward: '리롤권 5장' });
    expect(tiers.at(-1)).toMatchObject({ need: 50, kind: 'bonus' });
  });

  it('다음 단계까지 남은 은퇴 수, 다 열면 없다', () => {
    expect(passNext(season())).toEqual({ tier: 6, left: 2 });
    expect(passNext(season({ progress: 60, tier: 14 }))).toBeNull();
  });

  it('산 패스에서 열렸지만 받지 않은 단계가 있을 때만 받기를 보인다', () => {
    expect(passClaimable(season())).toBe(true);
    expect(passClaimable(season({ claimed: 5 }))).toBe(false);
    expect(passClaimable(season({ owned: false, claimed: 0 }))).toBe(false);
  });

  it('모든 단계 보상 합계', () => {
    expect(passTotalText()).toBe(
      '리롤권 59장, 잠재력 강화권 65장, 프리미엄 스카우트권 14장, 선수 이름 변경권 2장',
    );
  });

  it('T-11-748 지금 사면 받는 보상은 열린 단계까지만 합친다', () => {
    const none = { owned: false, claimed: 0 };
    // 진행도 0: 1단계(사면 바로)만.
    expect(passBuyNowText(season({ ...none, progress: 0, tier: 1 }))).toBe(
      '리롤권 10장, 잠재력 강화권 10장, 프리미엄 스카우트권 2장',
    );
    // 은퇴 12명 = 1~8단계 합계. 앞으로 열릴 단계(전체 합계)는 섞지 않는다.
    const twelve = passBuyNowText(season({ ...none, progress: 12, tier: 8 }));
    expect(twelve).toBe(
      '리롤권 33장, 잠재력 강화권 23장, 프리미엄 스카우트권 5장, 선수 이름 변경권 1장',
    );
    expect(twelve).not.toBe(passTotalText());
    // 모든 단계를 열었으면 전체 합계와 같다.
    expect(passBuyNowText(season({ ...none, progress: 60, tier: PASS_TIER_COUNT }))).toBe(
      passTotalText(),
    );
    // 이미 산 패스는 구매 안내가 없다.
    expect(passBuyNowText(season())).toBe('');
  });
});
