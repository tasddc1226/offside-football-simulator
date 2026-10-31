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
  // T-11-376 구단 팀 편성. 서버가 팀 저장·조회 때 활성 버전을 바로 읽는다(커리어별 고정 아님).
  team: '구단 팀',
  // T-11-374 카드 과제. 서버가 내기 · 조회 때 활성 버전을 바로 읽는다(커리어별 고정 아님).
  exchange: '카드 과제',
  // T-11-375 구단 디비전. 서버가 랭크 경기 · 디비전 랭킹 · 시즌 마감 때 활성 버전을 바로 읽는다.
  division: '구단 디비전',
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
  potGrowthFloor: {
    group: 'growth',
    label: '잠재력 근처 최소 성장',
    desc: 'OVR이 잠재력에 닿거나 넘었을 때도 남는 성장 배율의 하한',
  },
  targetManRole: {
    group: 'growth',
    label: '타깃맨 전용 OVR',
    desc: '1이면 타깃맨 유형 스트라이커의 OVR을 헤딩·몸싸움·점프 비중이 큰 타깃맨 역할로 계산',
  },
  wingerRole: {
    group: 'growth',
    label: '측면 미드필더 윙어 OVR',
    desc: '1이면 윙어 유형 좌·우 미드필더의 OVR을 중앙 미드필더·윙어 역할 중 높은 쪽으로 계산',
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
  boostGreat: {
    group: 'growth',
    label: '잠재력 강화 대성공 비율',
    desc: '강화 성공 중 두 단계를 한 번에 올리는 비율(대성공 확률 = 성공 확률 × 이 값). 마지막 단계 시도엔 없다. 0이면 끈다',
  },
  careCost: {
    group: 'growth',
    label: '몸 관리 비용 배율',
    desc: '30대 몸 관리 비용(단계별 연봉 비례·최소 금액·하락 깊이)에 곱하는 값',
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
  bloomDrift: {
    group: 'growth',
    label: '숨은 잠재력 흔들림',
    desc: '스카우트 평가에 안 보이는 숨은 잠재력이 해마다 흔들리는 표준편차 — 클수록 재평가에서 크게 오르내린다',
  },
  bloomAge: {
    group: 'growth',
    label: '숨은 잠재력 고정 나이',
    desc: '이 나이까지 숨은 잠재력이 해마다 흔들리고, 그 뒤로는 멈춘다',
  },
  rescoutShare1: {
    group: 'growth',
    label: '21세 재평가 반영 몫',
    desc: '21세 스카우트 재평가가 그때까지 쌓인 숨은 잠재력 중 평가에 옮기는 비율',
  },
  rescoutShare2: {
    group: 'growth',
    label: '24세 재평가 반영 몫',
    desc: '24세 스카우트 재평가가 남은 숨은 잠재력 중 평가에 옮기는 비율',
  },
  rescoutDownScale: {
    group: 'growth',
    label: '재평가 하락 비율',
    desc: '재평가가 잠재력을 깎을 때 실제로 깎는 비율 — 1이면 그대로, 0.7이면 30%는 없던 일로 한다',
  },
  rescoutDropCap: {
    group: 'growth',
    label: '재평가 한 번 최대 하락',
    desc: '재평가 한 번에 잠재력이 내려가는 최대 폭(99면 제한 없음). 넘는 몫은 없던 일로 한다',
  },
  premiumSMult: {
    group: 'growth',
    label: '프리미엄 스카우트 S 배수',
    desc: '프리미엄 스카우트권 후보 한 명이 S일 확률을 일반 후보의 몇 배로 할지. 확률 공개표도 이 값으로 계산한다',
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
  newLeagues: {
    group: 'transfer',
    label: '시즌 2 새 리그 열기',
    desc: '1이면 브라질 · 포르투갈 · 사우디 · 중국 리그 구단이 이적 · 임대 제의를 내고 대륙 대회 상대로 나온다(진행 중 커리어는 다음 시즌부터)',
  },
  eraRival: {
    group: 'event',
    label: '시대의 라이벌',
    desc: '1이면 눈에 띈 시즌(25세 이하)에 또래 라이벌이 나타나 따로 성장하고 시즌마다 기록 · 수상을 비교한다(내 결과는 바뀌지 않는다)',
  },
  richYoungPull: {
    group: 'transfer',
    label: '28세 미만 사우디 · 중국 오퍼 가중치',
    desc: '28세 미만 선수에게 사우디 · 중국 구단이 오퍼를 낼 가중치(28세 이상은 1)',
  },
  braPull: {
    group: 'transfer',
    label: '브라질 오퍼 가중치',
    desc: '브라질 구단이 오퍼를 낼 가중치(1이면 다른 리그와 같다). 한국 선수의 브라질행은 드물어 낮게 둔다',
  },
  koreaStr: {
    group: 'national',
    label: 'A대표팀 전력',
    desc: '월드 챔피언십·아시안컵·A매치에서 한국 대표팀 전력',
  },
  agKoreaBonus: {
    group: 'national',
    label: '아시안게임 한국 전력 보정', // i18n-ignore admin-only copy
    desc: '아시안게임에서만 한국 U-23 전력에 더한다. 올림픽과 다른 국적에는 적용하지 않는다', // i18n-ignore admin-only copy
  },
  koreaU23: {
    group: 'national',
    label: 'U-23 대표팀 전력',
    desc: '아시안게임·올림픽에서 한국 U-23 대표팀 전력',
  },
  wcQual: {
    group: 'national',
    label: '월드 챔피언십 예선 통과 확률',
    desc: '월드 챔피언십 아시아 예선을 통과할 확률',
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
  pastSalaryBudget: {
    group: 'team',
    label: '지난 시즌 선수 급여 예산',
    desc: '시즌 1 기준 구단 팀 선발에 넣은 지난 시즌 선수 급여(최고 OVR로 1~20) 합의 상한. 이번 시즌 선수는 급여가 없다',
  },
  pastSalaryBudgetStep: {
    group: 'team',
    label: '시즌당 급여 예산 증가',
    desc: '팀 시즌이 하나 지날 때마다 급여 예산에 더하는 값. 시즌 n 예산 = 기준 예산 + 이 값 × (n - 1)',
  },
  leagueHomeAdv: {
    group: 'team',
    label: '리그 홈 이점',
    desc: '오프사이드 리그 경기에서 홈 팀 기대 득점에 곱하는 배율. 1이면 홈 이점 없음. 랭크 경기 · 친선은 1.08 고정',
  },
  leagueFatigue: {
    group: 'team',
    label: '리그 체력',
    desc: '오프사이드 리그에 연속 선발로 나간 선수의 자리 실력을 단계마다 깎는 비율. 3경기 연속부터 1단계, 최대 3단계이고 한 경기 쉬면 회복한다. 0이면 끈다. 랭크 경기 · 친선 · 컵에는 없다',
  },
  cupAtkK: {
    group: 'team',
    label: '컵 전력 차이 반영',
    desc: '오프사이드 컵 경기에서 공격과 상대 수비벽 10점 차이가 기대 득점에 주는 무게(지수). 0.3이면 2회 컵까지, 0.45면 랭크 경기와 같다. 경기 전 예상에도 같이 쓴다',
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
  scoutPrice: {
    group: 'market',
    label: '프리미엄 스카우트권 가격',
    desc: '구단 자금으로 사는 프리미엄 스카우트권 한 장 가격(만 원)',
  },
  scoutWeeklyCap: {
    group: 'market',
    label: '주간 프리미엄 스카우트권 구매 수',
    desc: '한 구단주가 한 주(월요일 0시 한국 시각부터)에 구단 자금으로 살 수 있는 프리미엄 스카우트권 수. 0이면 팔지 않는다',
  },
  exchangeRewardReroll: {
    group: 'exchange',
    label: '카드 과제 완료 리롤권',
    desc: '오늘 카드 과제 세 개를 모두 낸 날 한 번 받는 선수 후보 리롤권 수',
  },
  exchangeRewardBoost: {
    group: 'exchange',
    label: '카드 과제 완료 잠재력 강화권',
    desc: '오늘 카드 과제 세 개를 모두 낸 날 한 번 받는 잠재력 강화권 수',
  },
  exchangeRewardScout: {
    group: 'exchange',
    label: '카드 과제 완료 프리미엄 스카우트권',
    desc: '오늘 카드 과제 세 개를 모두 낸 날 한 번 받는 프리미엄 스카우트권 수',
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
  surePrice: {
    group: 'market',
    label: '확정 강화 가격',
    desc: '구단 자금으로 확률 없이 잠재력 강화 한 단계를 받을 때 그날 첫 가격(만 원). 같은 날 다시 사면 보상 가격 상승 배율만큼 오른다',
  },
  sureDailyCap: {
    group: 'market',
    label: '확정 강화 하루 횟수',
    desc: '구단 자금 확정 강화를 하루에 받을 수 있는 횟수(구단주 기준, 선수마다 한 번). 0이면 팔지 않는다',
  },
  teamDiv1: {
    group: 'division',
    label: '세미프로 II 승격 RP',
    desc: '팀 RP가 이 값 이상이면 세미프로 II 디비전으로 오른다. 앞 경계보다 낮게 두면 앞 경계 값을 쓴다',
  },
  teamDiv2: {
    group: 'division',
    label: '세미프로 I 승격 RP',
    desc: '팀 RP가 이 값 이상이면 세미프로 I 디비전으로 오른다. 앞 경계보다 낮게 두면 앞 경계 값을 쓴다',
  },
  teamDiv3: {
    group: 'division',
    label: '프로 II 승격 RP',
    desc: '팀 RP가 이 값 이상이면 프로 II 디비전으로 오른다. 앞 경계보다 낮게 두면 앞 경계 값을 쓴다',
  },
  teamDiv4: {
    group: 'division',
    label: '프로 I 승격 RP',
    desc: '팀 RP가 이 값 이상이면 프로 I 디비전으로 오른다. 앞 경계보다 낮게 두면 앞 경계 값을 쓴다',
  },
  teamDiv5: {
    group: 'division',
    label: '엘리트 II 승격 RP',
    desc: '팀 RP가 이 값 이상이면 엘리트 II 디비전으로 오른다. 앞 경계보다 낮게 두면 앞 경계 값을 쓴다',
  },
  teamDiv6: {
    group: 'division',
    label: '엘리트 I 승격 RP',
    desc: '팀 RP가 이 값 이상이면 엘리트 I 디비전으로 오른다. 앞 경계보다 낮게 두면 앞 경계 값을 쓴다',
  },
  teamDiv7: {
    group: 'division',
    label: '마스터 승격 RP',
    desc: '팀 RP가 이 값 이상이면 마스터 디비전으로 오른다. 앞 경계보다 낮게 두면 앞 경계 값을 쓴다',
  },
  teamDivGuard: {
    group: 'division',
    label: '디비전 강등 보호 점수',
    desc: '올라간 디비전은 RP가 그 경계보다 이만큼 더 떨어져야 내려간다',
  },
  teamDivRewardFrom: {
    group: 'division',
    label: '디비전 보상 시작 시즌',
    desc: '이 시즌 마감부터 디비전 배지 · 리롤권을 준다. 그 전 시즌은 디비전을 보여 주기만 한다',
  },
  teamDivMinMatches: {
    group: 'division',
    label: '디비전 보상 최소 경기 수',
    desc: '시즌 마감 디비전 보상을 받으려면 그 시즌 팀이 치른 랭크 경기(건 경기 + 받은 경기) 수가 이만큼 있어야 한다',
  },
  teamDivReward3: {
    group: 'division',
    label: '프로 II 시즌 보상 리롤권',
    desc: '시즌 마감 때 프로 II 디비전인 구단주가 받는 선수 후보 리롤권 장수',
  },
  teamDivReward4: {
    group: 'division',
    label: '프로 I 시즌 보상 리롤권',
    desc: '시즌 마감 때 프로 I 디비전인 구단주가 받는 선수 후보 리롤권 장수',
  },
  teamDivReward5: {
    group: 'division',
    label: '엘리트 II 시즌 보상 리롤권',
    desc: '시즌 마감 때 엘리트 II 디비전인 구단주가 받는 선수 후보 리롤권 장수',
  },
  teamDivReward6: {
    group: 'division',
    label: '엘리트 I 시즌 보상 리롤권',
    desc: '시즌 마감 때 엘리트 I 디비전인 구단주가 받는 선수 후보 리롤권 장수',
  },
  teamDivReward7: {
    group: 'division',
    label: '마스터 시즌 보상 리롤권',
    desc: '시즌 마감 때 마스터 디비전인 구단주가 받는 선수 후보 리롤권 장수',
  },
};
