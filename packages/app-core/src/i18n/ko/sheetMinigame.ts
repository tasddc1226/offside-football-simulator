// 원터치 미니게임·드래그 슛 시트(웹 ui/sheets/{Minigame,DragShot}.svelte · 앱 sheets/{Minigame,DragShot}.tsx).
import { ns } from '../core';

const ko = {
  // 원터치 미니게임
  mgEyebrow: '원터치 · 초록 구간에서 멈추세요',
  mgA11y: (p: { tap: string }) => `${p.tap}. 바늘이 초록 구간에 올 때 누르세요`,
  late: '시간 초과!',
  saveOk: '선방!',
  saveFail: '실점…',
  goal: '골!',
  crossbar: '크로스바!',
  tooLong: '너무 길었다!',
  blocked: '막혔다!',
  // 드래그 슛
  dragEyebrow: '드래그 슛 · 골문 쪽으로 끌어 올리세요',
  dragA11y: '드래그 슛. 공에서 골문 쪽으로 끌었다가 떼면 찹니다',
  dragHint: '골문 쪽(위)으로 더 길게 끌었다가 떼세요',
  dragIdle: '↑ 위로 끌었다 떼기',
  shotSaved: '선방에 막혔다!',
  shotPost: '골대를 때렸다!',
  shotOver: '하늘로 떴다…',
  shotWide: '빗나갔다!',
  lateReadout: (p: { sec: number }) => `${p.sec}초 안에 차지 않았어요`,
  powerWeak: '약함',
  powerOver: '과함',
  powerGood: '좋음',
  readout: (p: { power: number; label: string; straight: number }) =>
    `세기 ${p.power}% (${p.label}) · 곧게 차기 ${p.straight}%`,
};

export type SheetMinigameMsgs = typeof ko;
export const sheetMinigameText = ns('sheetMinigame', ko);
