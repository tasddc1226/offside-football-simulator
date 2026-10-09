// T-11-174 인앱 상품(리롤권 · 잠재력 강화권 묶음) — 앱 platform/iapItems.ts · IapPacks.tsx · 선수 탭 강화 카드.
import { ns } from '../core';

const ko = {
  packsTitle: '스토어에서 사기',
  rerollPack: (p: { n: number }) => `리롤권 ${p.n}장`,
  boostPack: (p: { n: number }) => `잠재력 강화권 ${p.n}장`,
  busy: '결제 중…',
  loading: '스토어 확인 중…',
  storeFail: '스토어에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  payStartFail: '결제를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  payFail: '결제하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  pending: '결제 승인을 기다리고 있어요. 승인되면 자동으로 받아요.',
  rerollDone: (p: { n: number }) => `리롤권을 받았어요. 이제 ${p.n}장이에요.`,
  boostDone: (p: { n: number }) => `잠재력 강화권을 받았어요. 이제 ${p.n}장이에요.`,
  claimFail: '결제는 끝났어요. 받는 중에 문제가 생겨 다음에 앱을 열 때 다시 받아요.',
  rerollNote:
    '리롤권은 새 선수를 만들 때 후보 3명을 다시 뽑는 데 써요. 결제는 스토어 계정으로 하고, 이 구단주 계정에 들어와요.',
  boostBuyLead: '강화권으로 광고 없이 바로 시도할 수 있어요.',
  boostNote: (p: { chance: number }) =>
    `강화권 한 장은 광고 · 구단 자금으로 받는 시도 한 번과 같아요. 지금 성공 확률은 ${p.chance}%예요(실패하면 다음 확률이 올라요). 쓸 수 있는 때와 횟수도 같아요.`,
  // T-11-178 구단주 화면 리롤권 상점 아래 잠재력 강화권 상점.
  shopTitle: '잠재력 강화권 상점',
  shopSub: '선수 탭 잠재력 강화에서 써요',
  shopSubHave: (p: { n: number }) => `가진 강화권 ${p.n}장 · 선수 탭 잠재력 강화에서 써요`,
  shopNote:
    '강화권 한 장은 광고 · 구단 자금으로 받는 시도 한 번과 같아요. 성공 확률과 쓸 수 있는 때 · 횟수도 같아요. 결제는 스토어 계정으로 하고, 이 구단주 계정에 들어와요.',
  shopWeb: '강화권은 앱에서 살 수 있어요.',
};

export type IapMsgs = typeof ko;
export const iapText = ns('iap', ko);
