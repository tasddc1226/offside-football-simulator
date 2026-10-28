import type { Translation } from '../core';
import type { SheetMinigameMsgs } from '../ko/sheetMinigame';

export const sheetMinigame: Translation<SheetMinigameMsgs> = {
  mgEyebrow: '一觸即發 · 在綠色區間停下',
  mgA11y: (p) => `${p.tap}。指針進入綠色區間時點擊`,
  late: '時間到！',
  saveOk: '神撲！',
  saveFail: '失球……',
  goal: '進球！',
  crossbar: '中橫樑！',
  tooLong: '拖太久了！',
  blocked: '被擋下了！',
  dragEyebrow: '拖曳射門 · 朝球門方向往上拉',
  dragA11y: '拖曳射門。從球往球門方向拖曳後放開即可射門',
  dragHint: '往球門方向（上方）拖長一點再放開',
  dragIdle: '↑ 往上拖曳後放開',
  shotSaved: '被門將撲出！',
  shotPost: '擊中門柱！',
  shotOver: '球飛上天了……',
  shotWide: '射偏了！',
  lateReadout: (p) => `${p.sec} 秒內沒有射門`,
  powerWeak: '太弱',
  powerOver: '太強',
  powerGood: '剛好',
  readout: (p) => `力道 ${p.power}%（${p.label}）· 精準度 ${p.straight}%`,
};
