// T-11-627 커리어 탭의 카드 등급 전망(웹 tabs/CareerTab.svelte · 앱 components/CareerTab.tsx). 은퇴해 보기 전에는
// 왜 OVR 99인데 레전드 카드인지 알 수 없었다. 영구결번 기준은 서버 전용이라(T-10-076) 여기서 다루지 않는다.
import {
  CARD_ELITE_PEAK,
  CARD_GOLD_PEAK,
  CARD_ICON_SCORE,
  CARD_LEGEND_SCORE,
  CARD_SILVER_PEAK,
  cardTier,
} from '@offside/contracts/card-tier';
import { gameCareerText as L } from './i18n/ko/gameCareer.js';

const n = (x: number) => x.toLocaleString('en-US');

export function legendTrack(score: number, peak: number) {
  const nextTier = score >= CARD_ICON_SCORE ? null : score >= CARD_LEGEND_SCORE ? 'icon' : 'legend';
  const target = nextTier === 'icon' ? CARD_ICON_SCORE : CARD_LEGEND_SCORE;
  return {
    tier: cardTier(score, peak),
    /** 다음 특별 등급까지 채운 비율. 아이콘이면 100. */
    pct: nextTier ? Math.max(0, Math.min(100, Math.floor((score / target) * 100))) : 100,
    now: L.legendTrackNow({ tier: L.legendTierName({ tier: cardTier(score, peak) }) }),
    score: L.legendTrackScore({ score: n(score) }),
    next: nextTier
      ? L.legendTrackNext({
          tier: L.legendTierName({ tier: nextTier }),
          remaining: n(target - score),
        })
      : L.legendTrackTop,
    rules: L.legendTrackRules({
      icon: n(CARD_ICON_SCORE),
      legend: n(CARD_LEGEND_SCORE),
      elite: CARD_ELITE_PEAK,
      gold: CARD_GOLD_PEAK,
      silver: CARD_SILVER_PEAK,
    }),
  };
}
