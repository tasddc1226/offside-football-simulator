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
};

export type GameBoostMsgs = typeof ko;
export const gameBoostText = ns('gameBoost', ko);
