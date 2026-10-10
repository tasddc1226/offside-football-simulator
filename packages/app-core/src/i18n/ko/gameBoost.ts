// 선수 탭 '잠재력 강화' 카드·연출 문구(웹 PlayerTab.svelte · BoostFx.svelte · 앱 PlayerTab.tsx · BoostFx.tsx · app-core boost-view.ts).
// 금액은 부르는 쪽이 서식을 맞춰(fmtMoney + '원') 문자열로 넘긴다.
import { ns } from '../core';

const ko = {
  title: '잠재력 강화',
  stepsLabel: (p: { max: number; lv: number }) => `${p.max}단계 중 ${p.lv}단계`,
  rolling: '강화 중…',
  chance: (p: { n: number }) => `성공 확률 ${p.n}%`,
  confirmBtn: '강화하기',
  cancel: '취소',
  close: '확인',
  adLoading: '광고 불러오는 중…',
  note: (p: { age: number; pct: number }) =>
    `시즌마다 한 번, ${p.age}세까지 시도할 수 있어요. 실패하면 자금만 잃고 다음 확률이 ${p.pct}%p 올라요.`,
  lineLocked: '첫 시즌을 마치면 강화할 수 있어요.',
  lineAged: (p: { age: number }) => `${p.age}세가 지나 더는 강화할 수 없어요.`,
  lineMax: (p: { lv: number }) => `최고 단계(+${p.lv})에 닿았어요.`,
  lineDone: '이번 시즌엔 이미 시도했어요. 다음 시즌에 다시 할 수 있어요.',
  lineExtra: (p: { left: number }) =>
    `이번 시즌 시도는 했어요. 광고나 구단 자금으로 더 시도할 수 있고, 이 선수는 ${p.left}번 남았어요.`,
  lineExtraClub: (p: { left: number }) =>
    `이번 시즌 시도는 했어요. 구단 자금으로 더 시도할 수 있고, 이 선수는 ${p.left}번 남았어요.`,
  lineShort: (p: { cost: string }) => `자금이 모자라요. 다음 단계에 ${p.cost}이 필요해요.`,
  lineReady: (p: { next: number; chance: number; cost: string }) =>
    `다음 단계 +${p.next} · 성공 확률 ${p.chance}% · ${p.cost}`,
  button: (p: { cost: string; chance: number }) => `${p.cost} 내고 강화하기 (${p.chance}%)`,
  confirm: (p: { cost: string; chance: number }) =>
    `${p.cost}을 쓰고 ${p.chance}% 확률로 시도해요. 실패하면 돌려받지 못해요.`,
  historyOk: (p: { y: number; lv: number; pct: number; cost: string }) =>
    `${p.y} · +${p.lv}단계 ${p.pct}% · ${p.cost} · 성공`,
  historyFail: (p: { y: number; lv: number; pct: number; cost: string }) =>
    `${p.y} · +${p.lv}단계 ${p.pct}% · ${p.cost} · 실패`,
  resultOkTitle: (p: { lv: number }) => `+${p.lv}단계 성공`,
  resultFailTitle: '강화 실패',
  resultOkMax: '최고 단계에 닿았어요. 성장 한계가 한 뼘 더 올라갔어요.',
  resultOk: '성장 한계가 한 뼘 더 올라갔어요.',
  resultFail: (p: { chance: number; pct: number }) =>
    `성공 확률 ${p.chance}%였어요. 자금은 돌려받지 못하고, 다음 시도 확률이 ${p.pct}%p 올라요.`,
  // T-11-116 자금이 모자랄 때 보상형 광고(앱)로 시도한다.
  adButton: (p: { chance: number }) => `광고 보고 강화하기 (${p.chance}%)`,
  adButtonFree: (p: { chance: number }) => `자금 없이 강화하기 (${p.chance}%)`,
  adNote:
    '광고를 끝까지 보면 자금 없이 한 번 시도할 수 있어요. 성공 확률은 자금으로 시도할 때와 같아요.',
  adNoteFree: '광고 제거를 구매해서 자금 없이 한 번 시도할 수 있어요.',
  adNoteExtra: (p: { left: number }) =>
    `광고를 끝까지 보면 자금 없이 한 번 더 시도해요. 추가 시도는 이 선수에게 ${p.left}번 남았어요.`,
  adNoteExtraFree: (p: { left: number }) =>
    `광고 제거를 구매해서 자금 없이 한 번 더 시도할 수 있어요. 추가 시도는 이 선수에게 ${p.left}번 남았어요.`,
  adWatch: '광고를 끝까지 보면 강화를 시도할 수 있어요.',
  adCost: '광고',
  extraCost: (p: { cost: string }) => `${p.cost}(추가)`,
  clubCost: '구단 자금',
  resultFailFree: (p: { chance: number; pct: number }) =>
    `성공 확률 ${p.chance}%였어요. 다음 시도 확률이 ${p.pct}%p 올라요.`,
  // T-11-153 광고 대신 구단 자금으로 받기(후보 잠재력 · 시즌 평가 · 강화). price·balance는 fundsText로 쓴 금액.
  clubCandidates: (p: { price: string }) => `구단 자금으로 후보 잠재력 보기 (${p.price})`,
  clubPeek: (p: { price: string }) => `구단 자금으로 평가 보기 (${p.price})`,
  clubBoost: (p: { price: string; chance: number }) =>
    `구단 자금으로 강화하기 (${p.price} · ${p.chance}%)`,
  clubConfirm: (p: { price: string; balance: string }) =>
    `구단 자금 ${p.price}을 써요. 쓴 뒤 구단 자금은 ${p.balance} 남고, 되돌릴 수 없어요.`,
  clubAskTitle: '구단 자금 쓰기',
  clubAction: '쓰기',
  clubBusy: '구단 자금을 쓰는 중이에요…',
  clubNote: '광고를 보거나 구단 자금을 써서 받을 수 있어요. 구단 자금은 같은 날 쓸수록 비싸져요.',
  clubFail: '구단 자금을 쓰지 못했어요.',
  // T-11-174 앱에서 산 잠재력 강화권을 웹에서 쓴다. n은 남은 장수.
  ticketCost: '강화권',
  ticketBoost: (p: { n: number; chance: number }) => `강화권 쓰기 (${p.n}장 · ${p.chance}%)`,
  ticketBusy: '강화권을 쓰는 중이에요…',
  ticketFail: '강화권을 쓰지 못했어요.',
  // T-11-184 강화권은 추가 시도 상한이 없다.
  lineExtraTicket: '이번 시즌 시도는 했어요. 강화권으로는 횟수 상한 없이 더 시도할 수 있어요.',
};

export type GameBoostMsgs = typeof ko;
export const gameBoostText = ns('gameBoost', ko);
