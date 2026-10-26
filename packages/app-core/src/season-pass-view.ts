// T-11-511 시즌 패스 그리기 값(웹 owner/SeasonPass.svelte · 앱 screens/owner/SeasonPass.tsx가 같이 쓴다).
import type { SeasonPassSeason } from '@offside/contracts';
import { SEASON_GAUGE } from '@offside/contracts/season-gauge';
import { passRewardTotal, SEASON_PASS_TIERS } from '@offside/contracts/season-pass';
import { rewardText } from './attendance-view';

export type PassTierState = 'claimed' | 'open' | 'locked';

/** 단계표: 받은 단계 · 열린 단계 · 아직 잠긴 단계. 패스가 없어도 진행도로 열린 단계는 'open'이다(받기는 패스가 있어야 한다). */
export const passTiers = (s: SeasonPassSeason) =>
  SEASON_PASS_TIERS.map((t) => ({
    tier: t.tier,
    need: t.need,
    reward: rewardText(t.reward),
    state: (t.tier <= s.claimed
      ? 'claimed'
      : t.tier <= s.tier
        ? 'open'
        : 'locked') as PassTierState,
  }));

/** 다음 단계와 남은 은퇴 수. 다 열었으면 null. */
export function passNext(s: SeasonPassSeason) {
  const t = SEASON_PASS_TIERS[s.tier];
  return t ? { tier: t.tier, left: t.need - s.progress } : null;
}

/** 받을 보상이 있나(산 패스에서 열렸지만 받지 않은 단계). */
export const passClaimable = (s: SeasonPassSeason) => s.owned && s.tier > s.claimed;

export const PASS_TIER_COUNT = SEASON_PASS_TIERS.length;
export const passTotalText = () => rewardText(passRewardTotal());
/** 진행도 규칙 안내에 넣는 숫자. */
export const PASS_RULE = { age: SEASON_GAUGE.fullAge, daily: SEASON_GAUGE.dailyCap };
