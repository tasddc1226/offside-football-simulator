// T-11-244 오프사이드 컵 성적별 보상 한 줄(웹 Cup.svelte · 앱 CupScreen · TeamCup이 같이 쓴다). 리롤권, 프리미엄 스카우트권,
// 잠재력 강화권(T-11-249 제2회부터), 트로피·칭호 순서로 잇는다.
import { cupReward, type CupStage } from '@offside/contracts/cup';
import { cupText as L } from './i18n/ko/cup.js';

export function cupRewardText(edition: number, stage: CupStage, trophy = true): string {
  const r = cupReward(edition, stage);
  return [
    L.rewardReroll({ n: r.rerolls }),
    ...(r.scouts ? [L.rewardScout({ n: r.scouts })] : []),
    ...(r.boosts ? [L.rewardBoost({ n: r.boosts })] : []),
    ...(trophy && r.trophy ? [L.rewardTrophy] : []),
  ].join(' · ');
}
