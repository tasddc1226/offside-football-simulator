/**
 * T-11-157c 운영 도구(밸런스 화면)에만 쓰는 밸런스 수치의 구분·이름·설명. 게임이 읽는 숫자(`./balance`)와 나눠
 * 첫 화면 번들에 이 문구가 실리지 않게 한다. 키는 BALANCE_SPEC과 같다(타입으로 검사). 이름은 공개 이력용
 * app-core `i18n/ko/balanceKeys.ts`와 같아야 한다(fairness.test.ts가 검사).
 */
import type { BalanceKey } from './balance-spec.js';

export const BALANCE_GROUPS = {
  event: '이벤트',
  growth: '성장 · 부상',
  transfer: '이적',
  national: '대표팀',
  military: '병역',
  // T-11-080 이적시장. 게임(웹)은 읽지 않고, 서버가 방출·등록·구매 요청 때 활성 버전을 바로 읽는다(커리어별 고정 아님).
  market: '이적시장',
} as const;
export type BalanceGroup = keyof typeof BALANCE_GROUPS;

interface BalanceKnobText {
  group: BalanceGroup;
  label: string;
  desc: string;
}

export const BALANCE_TEXT: Record<BalanceKey, BalanceKnobText> = {
  eventRatePreseason: {
    group: 'event',
    label: '프리시즌 이벤트 확률',
    desc: '프리시즌 구간마다 확률 이벤트가 생길 확률',
  },
  eventRateSeason: {
    group: 'event',
    label: '전·후반기 이벤트 확률',
    desc: '전반기·후반기 구간마다 확률 이벤트가 생길 확률',
  },
  eventTwist: {
    group: 'event',
    label: '선택 뒤 반전 확률',
    desc: '선택지를 고른 뒤 능력치 반전이 붙을 확률',
  },
  growthScale: {
    group: 'growth',
    label: '성장 배율',
    desc: '경기·훈련으로 오르는 능력치에 곱하는 값',
  },
  investGain: {
    group: 'growth',
    label: '특훈 성장 비율',
    desc: '자기 투자 특훈(약점 보강·강점 특화)이 능력치 훈련 한 번의 몇 배만큼 올리는지',
  },
  investCost: {
    group: 'growth',
    label: '자기 투자 비용 배율',
    desc: '자기 투자 비용(연봉 비례·최소 금액)에 곱하는 값',
  },
  boostCost: {
    group: 'growth',
    label: '잠재력 강화 비용 배율',
    desc: '잠재력 강화 비용(단계별 연봉 비례·최소 금액)에 곱하는 값',
  },
  boostExtraTotal: {
    group: 'growth',
    label: '커리어당 추가 강화 횟수',
    desc: '자금이 모자란 시즌의 강화 추가 시도 횟수(커리어 전체). 0이면 없다',
  },
  potMean: {
    group: 'growth',
    label: '잠재력 평균',
    desc: '새 선수의 실제 잠재력 추첨 평균 — 높을수록 S·A가 늘고 D가 줄어든다. 시즌에 만든 새 커리어에만 쓰인다',
  },
  potSd: {
    group: 'growth',
    label: '잠재력 편차',
    desc: '새 선수의 실제 잠재력 추첨 표준편차 — 클수록 S와 D가 늘어난다. 시즌에 만든 새 커리어에만 쓰인다',
  },
  potScoutSd: {
    group: 'growth',
    label: '스카우트 평가 오차',
    desc: '화면에 보이는 스카우트 평가가 실제 잠재력에서 벗어나는 표준편차 — 0이면 평가가 정확하다',
  },
  injuryRate: {
    group: 'growth',
    label: '경기당 부상 확률',
    desc: '한 경기를 뛸 때 다칠 기본 확률(체력·나이·특성 보정 전)',
  },
  bigInjuryShare: {
    group: 'growth',
    label: '큰 부상 비율',
    desc: '부상 중 8~18경기 결장하는 큰 부상의 비율',
  },
  mlsYoungPull: {
    group: 'transfer',
    label: '30세 미만 MLS 오퍼 가중치',
    desc: '30세 미만 선수에게 MLS 구단이 오퍼를 낼 가중치(30세 이상은 1)',
  },
  koreaStr: {
    group: 'national',
    label: 'A대표팀 전력',
    desc: '월드컵·아시안컵·A매치에서 한국 대표팀 전력',
  },
  koreaU23: {
    group: 'national',
    label: 'U-23 대표팀 전력',
    desc: '아시안게임·올림픽에서 한국 U-23 대표팀 전력',
  },
  wcQual: {
    group: 'national',
    label: '월드컵 예선 통과 확률',
    desc: '월드컵 아시아 예선을 통과할 확률',
  },
  olympicQual: {
    group: 'national',
    label: '올림픽 예선 통과 확률',
    desc: '올림픽 아시아 예선(AFC U-23 아시안컵)을 통과할 확률',
  },
  agRelease: {
    group: 'national',
    label: '아시안게임 해외 구단 차출 허락',
    desc: '협상 이벤트 없이 해외 구단이 아시안게임 차출을 허락할 확률',
  },
  olyRelease: {
    group: 'national',
    label: '올림픽 해외 구단 차출 허락',
    desc: '협상 이벤트 없이 해외 구단이 올림픽 차출을 허락할 확률',
  },
  sangmuBase: {
    group: 'military',
    label: '상무 기본 합격률',
    desc: 'OVR 63 · 명성 30 기준 상무 합격률(리그·나이 보정 전)',
  },
  marketReleaseRate: {
    group: 'market',
    label: '방출 지급률',
    desc: '선수를 방출하면 카드 기준가에 이 값을 곱한 만큼 구단 자금이 생긴다',
  },
  marketRetireBonusRate: {
    group: 'market',
    label: '은퇴 장려금 비율',
    desc: '선수가 은퇴해 카드가 생길 때 카드 기준가에 이 값을 곱한 만큼 키운 사람에게 구단 자금을 준다. 0이면 주지 않는다',
  },
  marketFeeRate: {
    group: 'market',
    label: '거래 수수료율',
    desc: '선수가 팔리면 판매가에서 이 비율만큼 떼고 판매자에게 준다',
  },
  marketPriceMin: {
    group: 'market',
    label: '최저 판매가(기준가 배수)',
    desc: '판매가를 기준가의 이 배수 아래로 정할 수 없다',
  },
  marketPriceMax: {
    group: 'market',
    label: '최고 판매가(기준가 배수)',
    desc: '판매가를 기준가의 이 배수 위로 정할 수 없다',
  },
  marketListLimit: {
    group: 'market',
    label: '동시 판매 등록 수',
    desc: '한 구단주가 한 번에 올려 둘 수 있는 판매 등록 수',
  },
  marketDailyBuys: {
    group: 'market',
    label: '하루 영입 수',
    desc: '한 구단주가 하루(한국 시각)에 영입할 수 있는 선수 수',
  },
  rerollPrice: {
    group: 'market',
    label: '리롤권 가격',
    desc: '그날 첫 리롤권 가격(만 원). 같은 날 더 살 때마다 가격 상승 배율을 곱한다',
  },
  rerollPriceGrowth: {
    group: 'market',
    label: '리롤권 가격 상승 배율',
    desc: '같은 날(0시 한국 시각부터) 한 장 더 살 때마다 가격에 곱한다',
  },
  rerollDailyCap: {
    group: 'market',
    label: '하루 리롤권 구매 수',
    desc: '한 구단주가 하루(한국 시각)에 구단 자금으로 살 수 있는 리롤권 수. 0이면 팔지 않는다',
  },
  rewardPriceCandidates: {
    group: 'market',
    label: '후보 잠재력 보기 가격',
    desc: '광고 대신 구단 자금으로 후보 3명의 잠재력을 볼 때 그날 첫 가격(만 원). 같은 날 더 쓸 때마다 상승 배율을 곱한다',
  },
  rewardPricePeek: {
    group: 'market',
    label: '시즌 평가 보기 가격',
    desc: '광고 대신 구단 자금으로 이번 시즌 스카우트 평가를 볼 때 그날 첫 가격(만 원)',
  },
  rewardPriceBoost: {
    group: 'market',
    label: '잠재력 강화 가격',
    desc: '선수 자금이 모자란 시즌에 광고 대신 구단 자금으로 강화를 한 번 시도할 때 그날 첫 가격(만 원)',
  },
  rewardPriceGrowth: {
    group: 'market',
    label: '광고 대신 구단 자금 가격 상승 배율',
    desc: '같은 날(0시 한국 시각부터) 같은 보상을 한 번 더 받을 때마다 가격에 곱한다',
  },
  rewardDailyCap: {
    group: 'market',
    label: '광고 대신 구단 자금 하루 횟수',
    desc: '보상마다 한 구단주가 하루(한국 시각)에 구단 자금으로 받을 수 있는 횟수(잠재력 강화는 횟수 없음). 0이면 구단 자금으로 받지 않는다',
  },
};
