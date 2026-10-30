// 잠재력 재평가·달성도 문구(stats.ts), 변화량 칩 이름, 이벤트 반전·안전한 선택의 대가(event-runner.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  potAch0: '타고난 한계를 넘어섰어요.',
  potAch1: '재능을 끝까지 끌어냈어요.',
  potAch2: '조금은 남겨 두고 떠났어요.',
  potAch3: '다 피우지 못한 재능이었어요.',
  rescoutLate: '늦게 핀 재능이라는 평가입니다.',
  rescoutEarly: '성장 곡선이 예상보다 일찍 꺾였다는 평가입니다.',
  rescoutNarrow: '평가 범위가 좁혀졌습니다.',
  rescoutLog: (p: { before: string; after: string; note: string }) =>
    `스카우트 재평가: 잠재력 ${p.before} → ${p.after}등급. ${p.note}`,
  rescoutNote: (p: { before: string; after: string }) =>
    `스카우트 재평가 · 잠재력 ${p.before} → ${p.after}`,
  // 변화량 칩
  chipCond: '컨디션',
  chipMorale: '사기',
  chipFame: '인기',
  chipTrust: '감독 신뢰',
  chipMoney: '자금',
  chipInjury: '부상',
  chipOut: (p: { n: number }) => `${p.n}경기 결장`,
  chipPot: '잠재력',
  chipPotUp: '상승',
  // 이벤트 뒤 반전
  twistSafe: (p: { why: string }) => `안전한 선택의 대가 · ${p.why}`,
  twistUp: (p: { label: string; d: number }) => `뜻밖의 수확 · ${p.label} +${p.d}`,
  // 안전한 선택의 대가(이벤트 도감도 읽는다)
  costMoraleLabel: '사기',
  costMoraleWhy: '도전하지 않은 아쉬움',
  costMoraleWhy2: 'SNS에 달린 "소극적"이라는 댓글',
  costMoraleWhy3: '잠들기 전 자꾸 떠오른 그 장면',
  costTrustLabel: '감독 신뢰',
  costTrustWhy: '감독의 미지근한 평가',
  costTrustWhy2: '코치진 회의에서 나온 "한 방이 없다"는 말',
  costFameLabel: '명성',
  costFameWhy: '"무난했다"는 평가',
  costFameWhy2: '기사 한 줄 없이 지나간 한 주',
};
export type GStatsMsgs = typeof ko;
export const gStatsText = ns('gStats', ko);
