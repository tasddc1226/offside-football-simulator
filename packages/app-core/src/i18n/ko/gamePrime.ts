// T-11-733 선수 탭 '전성기 연장' 카드(웹 PlayerTab.svelte · 앱 PlayerTab.tsx · app-core prime-view.ts).
// peak는 능력치가 처음 떨어지는 시즌의 나이(그 나이 시즌이 끝날 때부터 떨어진다). 금액은 부르는 쪽이 서식을 맞춰 넘긴다.
import { ns } from '../core';

const ko = {
  title: '전성기 연장',
  rolling: '연장 도전 중…',
  stepsLabel: (p: { max: number; lv: number }) => `연장 ${p.max}단계 중 ${p.lv}단계`,
  lineReady: (p: { peak: number; next: number; chance: number; cost: string }) =>
    `지금은 ${p.peak}세 시즌이 끝나면 능력치가 떨어지기 시작해요. 성공하면 ${p.next}세까지 버텨요(성공 ${p.chance}% · ${p.cost}).`,
  lineShort: (p: { peak: number; cost: string }) =>
    `${p.peak}세 시즌이 끝나면 능력치가 떨어지기 시작해요. 다음 도전에는 ${p.cost}이 필요해요.`,
  lineDone: (p: { peak: number }) =>
    `이번 시즌 도전은 끝났어요. 능력치는 ${p.peak}세 시즌이 끝날 때부터 떨어져요.`,
  lineMax: (p: { peak: number }) =>
    `전성기를 끝까지 늘렸어요. 능력치는 ${p.peak}세 시즌이 끝날 때부터 떨어져요.`,
  button: '연장 도전',
  confirm: (p: { cost: string; chance: number }) =>
    `${p.cost}을 쓰고 성공 확률은 ${p.chance}%예요. 실패해도 돌려받지 못해요.`,
  confirmBtn: '도전하기',
  cancel: '취소',
  adCost: '광고',
  adNote: (p: { left: number }) =>
    `자금이 모자라면 광고를 보고 도전할 수 있어요(커리어에서 ${p.left}번 남음).`,
  adNoteFree: (p: { left: number }) =>
    `광고 제거로 자금 없이 도전할 수 있어요(커리어에서 ${p.left}번 남음).`,
  adWatch: '광고를 끝까지 보면 도전할 수 있어요.',
  note: (p: { max: number; pct: number }) =>
    `정점 나이 1년 전 시즌부터 시즌마다 한 번, 최대 ${p.max}단계까지 도전해요. 실패할 때마다 다음 확률이 ${p.pct}%p 올라요.`,
  noteGreat: (p: { pct: number }) => `성공 중 ${p.pct}%는 두 해를 한꺼번에 늘리는 대성공이에요.`,
  historyOk: (p: { y: number; lv: number; pct: number; cost: string }) =>
    `${p.y}년 +${p.lv}단계 성공 (${p.pct}% · ${p.cost})`,
  historyGreat: (p: { y: number; lv: number; pct: number; cost: string }) =>
    `${p.y}년 +${p.lv}단계 대성공 (${p.pct}% · ${p.cost})`,
  historyFail: (p: { y: number; lv: number; pct: number; cost: string }) =>
    `${p.y}년 +${p.lv}단계 실패 (${p.pct}% · ${p.cost})`,
  resultOkTitle: '전성기 연장 성공',
  resultGreatTitle: '대성공! 두 해 연장',
  resultFailTitle: '연장 실패',
  resultOk: (p: { peak: number }) => `이제 ${p.peak}세 시즌이 끝날 때부터 능력치가 떨어져요.`,
  resultFail: (p: { pct: number }) => `다음 도전 확률이 ${p.pct}%p 올라요.`,
};

export type GamePrimeMsgs = typeof ko;
export const gamePrimeText = ns('gamePrime', ko);
