// T-11-513 선수 탭 '몸 관리' 카드(웹 PlayerTab.svelte · 앱 PlayerTab.tsx · app-core care-view.ts). 금액은 부르는 쪽이 서식을
// 맞춰(fmtMoney + '원') 문자열로 넘긴다.
import { ns } from '../core';

const ko = {
  title: '몸 관리',
  tier1: '기본 관리',
  tier2: '집중 관리',
  tier3: '전담 의료진',
  lineOpen: '이번 시즌이 끝나면 능력치가 떨어져요. 몸 관리를 받으면 떨어지는 폭이 줄어요.',
  lineDone: (p: { name: string; cut: number }) =>
    `이번 시즌 몸 관리(${p.name})를 받고 있어요. 시즌 끝 하락이 ${p.cut}% 줄어요.`,
  option: (p: { cut: number }) => `하락 ${p.cut}% 줄이기`,
  short: '자금 부족',
  confirm: (p: { name: string; cost: string }) =>
    `${p.name}에 ${p.cost}을 써요. 이번 시즌 끝 하락에만 효과가 있고, 되돌릴 수 없어요.`,
  confirmBtn: '받기',
  cancel: '취소',
  note: '시즌마다 한 번 받을 수 있어요. 정점 나이에서 멀어질수록 비용이 올라요.',
  done: (p: { name: string }) => `몸 관리를 시작했어요(${p.name}).`,
};

export type GameCareMsgs = typeof ko;
export const gameCareText = ns('gameCare', ko);
