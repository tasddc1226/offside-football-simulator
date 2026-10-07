// 공개 밸런스 이력의 항목 이름(app-core fairness.ts · 확률 도감 '확률과 공정성'). 키는 @offside/contracts/balance의 BALANCE_SPEC과 같다.
import { ns } from '../core';

const ko = {
  eventRatePreseason: '프리시즌 이벤트 확률',
  eventRateSeason: '전·후반기 이벤트 확률',
  eventTwist: '선택 뒤 반전 확률',
  growthScale: '성장 배율',
  investGain: '특훈 성장 비율',
  investCost: '자기 투자 비용 배율',
  potMean: '잠재력 평균',
  potSd: '잠재력 편차',
  potScoutSd: '스카우트 평가 오차',
  injuryRate: '경기당 부상 확률',
  bigInjuryShare: '큰 부상 비율',
  mlsYoungPull: '30세 미만 MLS 오퍼 가중치',
  koreaStr: 'A대표팀 전력',
  koreaU23: 'U-23 대표팀 전력',
  wcQual: '월드컵 예선 통과 확률',
  olympicQual: '올림픽 예선 통과 확률',
  agRelease: '아시안게임 해외 구단 차출 허락',
  olyRelease: '올림픽 해외 구단 차출 허락',
  sangmuBase: '상무 기본 합격률',
  marketReleaseRate: '방출 지급률',
  marketFeeRate: '거래 수수료율',
  marketPriceMin: '최저 판매가(기준가 배수)',
  marketPriceMax: '최고 판매가(기준가 배수)',
  marketListLimit: '동시 판매 등록 수',
  marketDailyBuys: '하루 영입 수',
  eventWeight: (p: { n: number }) => `이벤트 등장 빈도 조정 ${p.n}건`,
  choiceBonus: (p: { n: number }) => `선택지 성공 확률 조정 ${p.n}건`,
};

export type BalanceKeysMsgs = typeof ko;
export const balanceKeysText = ns('balanceKeys', ko);
