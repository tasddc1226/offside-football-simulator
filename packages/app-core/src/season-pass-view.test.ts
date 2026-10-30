import { describe, expect, it } from 'vitest';
import {
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
});
