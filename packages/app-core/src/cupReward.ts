// T-11-244 오프사이드 컵 성적별 보상 한 줄(웹 Cup.svelte · 앱 CupScreen · TeamCup이 같이 쓴다). 리롤권, CUP_SCOUTS_FROM회부터
// 4강 이상의 프리미엄 스카우트권, 트로피·칭호 순서로 잇는다.
import { CUP_REWARDS, cupScouts, type CupStage } from '@offside/contracts/cup';
import { cupText as L } from './i18n/ko/cup.js';

export function cupRewardText(edition: number, stage: CupStage, trophy = true): string {
  const scouts = cupScouts(edition, stage);
  return [
    L.rewardReroll({ n: CUP_REWARDS[stage].rerolls }),
    ...(scouts ? [L.rewardScout({ n: scouts })] : []),
    ...(trophy && CUP_REWARDS[stage].trophy ? [L.rewardTrophy] : []),
  ].join(' · ');
}
