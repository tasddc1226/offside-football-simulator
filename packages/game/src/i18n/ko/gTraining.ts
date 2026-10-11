// 훈련·자기 투자 문구(training.ts): 카드 효과·태그·자세한 설명·로그. 훈련·투자 id는 세이브에 저장되고 문구만 여기서 읽는다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  // 훈련 이름
  attrTraining: (p: { attr: string }) => `${p.attr} 훈련`,
  rest: '휴식·회복',
  coach: '개인 코치',
  media: '미디어 활동',
  // 카드 효과·태그
  condition: (p: { v: string }) => `컨디션 ${p.v}`,
  morale: (p: { v: string }) => `사기 ${p.v}`,
  allAttrsUp: '전 능력 소폭 ▲',
  cost: (p: { money: string }) => `비용 ${p.money}`,
  fameRange: (p: { lo: number; hi: number }) => `인기 +${p.lo}~${p.hi}`,
  income: (p: { money: string }) => `수입 +${p.money}`,
  attrUp: (p: { attr: string }) => `${p.attr} ▲`,
  attrPairUp: (p: { a: string; b: string }) => `${p.a}·${p.b} ▲`,
  focusGrowth: (p: { pct: number }) => `주력 성장 +${p.pct}%`,
  tooFarAhead: (p: { pct: number }) => `너무 앞서 성장 −${p.pct}%`,
  // T-11-183 세부 능력치가 99에 닿으면 그 몫의 성장은 버려진다.
  maxed: (p: { attr: string }) => `${p.attr} 최고치 도달`,
  nearMax: (p: { pct: number }) => `최고치에 닿아 성장 −${p.pct}%`,
  // 자세한 설명
  helpRest: (p: { low: number; start: number }) =>
    `훈련을 쉬고 몸을 추슬러요. 컨디션이 ${p.low} 밑으로 떨어지면 부상 위험이 크게 늘고, ${p.start} 밑이면 선발로 나서기 어려워요.`,
  helpCoach:
    'OVR에 반영되는 능력치를 고르게 조금씩 키워요. 자금이 모자라면 컨디션을 회복하는 자율 훈련으로 바뀌어요.',
  helpMedia: (p: { contract: boolean }) =>
    `인터뷰·광고로 이름을 알려요. 인기가 높을수록 대표팀 발탁·이적 제안·광고 제의에 유리해요.${p.contract ? ' 계약 중이라 출연료도 들어와요.' : ''}`,
  helpAttrMain: (p: { attr: string }) =>
    `${p.attr} 능력치가 크게 오르고, 50% 확률로 다른 능력치 하나도 조금 올라요.`,
  helpPhy: (p: { pac: string }) => `${p.pac}도 함께 오르는 대신 컨디션이 더 떨어져요.`,
  helpFocus: (p: { pct: number }) => `주력 능력치라 성장이 ${p.pct}% 빨라요.`,
  helpOffFocus: (p: { pct: number }) => `주력 능력치가 아니라 성장이 ${p.pct}% 느려요.`,
  helpLopsided: (p: { pct: number }) =>
    `다른 핵심 능력치보다 너무 앞서 있어 성장이 ${p.pct}% 줄었어요. 다른 능력치를 키우면 제한이 풀려요.`,
  helpMaxed: (p: { attr: string }) =>
    `${p.attr} 세부 능력치가 모두 최고치(99)라 이 훈련으로는 더 오르지 않아요.`,
  helpNearMax: (p: { pct: number }) =>
    `최고치(99)에 닿은 세부 능력치가 있어 성장의 ${p.pct}%가 반영되지 않아요.`,
  helpOvrSubs: (p: { list: string }) => `이 항목 중 ${p.list} 능력치가 지금 포지션 OVR에 반영돼요.`,
  helpOvrSeparate: 'OVR 반영 여부와 경기에서의 활용은 달라요.',
  helpWeightLow: '지금 포지션의 OVR에는 거의 반영되지 않아요.',
  helpWeight: (p: { attr: string; pct: number }) =>
    `지금 포지션 OVR에서 ${p.attr} 비중은 ${p.pct}%예요.`,
  // 로그
  coachBroke: '자금이 부족해 개인 코치 대신 자율 훈련을 했습니다.',
  investBroke: (p: { label: string }) => `자금이 부족해 ${p.label} 투자를 중단했습니다.`,
  // 자기 투자
  investNone: '투자 안 함',
  investWeak: '약점 보강 특훈',
  investBest: '강점 특화 특훈',
  investAttr: (p: { attr: string }) => `${p.attr} 특훈`,
  investWeakNote: '약점',
  investBestNote: '강점',
  investMedical: '메디컬 케어',
  investMental: '멘탈 코칭',
  investSaveMoney: '자금을 아낀다',
  investMedicalInjury: (p: { games: number }) => `부상 결장 −${p.games}경기`,
  investShort: '자금 부족',
  helpInvestNone: '이번 구간에는 자금을 쓰지 않아요.',
  helpInvestMedical: (p: { games: number }) =>
    `전담 메디컬 팀이 몸을 관리해요. 컨디션이 오르고, 부상 중이면 복귀가 ${p.games}경기 빨라져요.`,
  helpInvestMental: '스포츠 심리 전문가와 상담해요. 사기가 높을수록 경기력과 성장이 좋아져요.',
  helpInvestWeak: (p: { attr: string }) => `가장 낮은 핵심 능력치(${p.attr})를 따로 끌어올려요.`,
  helpInvestBest: (p: { attr: string }) => `가장 높은 핵심 능력치(${p.attr})를 더 다듬어요.`,
  helpInvestGain: (p: { pct: number }) =>
    `훈련과 별개로, 능력치 훈련 한 번의 ${p.pct}% 정도 올라요.`,
  helpInvestLopsided: (p: { pct: number }) =>
    `다른 능력치보다 너무 앞서 있어 성장이 ${p.pct}% 줄었어요.`,
  helpInvestSkip: '자금이 모자라면 투자를 건너뛰고 ‘투자 안 함’으로 바뀌어요.',
};
export type GTrainingMsgs = typeof ko;
export const gTrainingText = ns('gTraining', ko);
