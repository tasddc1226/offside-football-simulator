import type { Translation } from '../core';
import type { GamePrimeMsgs } from '../ko/gamePrime';

export const gamePrime: Translation<GamePrimeMsgs> = {
  title: '全盛期延長',
  rolling: '延長挑戰中…',
  stepsLabel: (p) => `延長 ${p.max} 階中第 ${p.lv} 階`,
  lineReady: (p) =>
    `目前${p.peak}歲賽季結束後能力值就會開始下降。成功的話可以撐到${p.next}歲（成功率${p.chance}% · ${p.cost}）。`,
  lineShort: (p) => `${p.peak}歲賽季結束後能力值會開始下降。下次挑戰需要${p.cost}。`,
  lineDone: (p) => `本賽季已經挑戰過了。能力值會在${p.peak}歲賽季結束後開始下降。`,
  lineMax: (p) => `全盛期已延長到最大。能力值會在${p.peak}歲賽季結束後開始下降。`,
  button: '挑戰延長',
  confirm: (p) => `將花費${p.cost}，成功率${p.chance}%。失敗不會退還。`,
  confirmBtn: '挑戰',
  cancel: '取消',
  adCost: '廣告',
  adNote: (p) => `資金不足時可以看廣告挑戰（本段生涯還剩${p.left}次）。`,
  adNoteFree: (p) => `已移除廣告，可以不花資金挑戰（本段生涯還剩${p.left}次）。`,
  adWatch: '看完廣告就能挑戰。',
  note: (p) =>
    `從巔峰年齡前一年的賽季開始，每個賽季可挑戰一次，最多${p.max}階。每失敗一次，下次機率提高${p.pct}%p。`,
  noteGreat: (p) => `成功中有${p.pct}%是一次延長兩年的大成功。`,
  historyOk: (p) => `${p.y}年 +${p.lv}階 成功（${p.pct}% · ${p.cost}）`,
  historyGreat: (p) => `${p.y}年 +${p.lv}階 大成功（${p.pct}% · ${p.cost}）`,
  historyFail: (p) => `${p.y}年 +${p.lv}階 失敗（${p.pct}% · ${p.cost}）`,
  resultOkTitle: '全盛期延長成功',
  resultGreatTitle: '大成功！延長兩年',
  resultFailTitle: '延長失敗',
  resultOk: (p) => `現在能力值會在${p.peak}歲賽季結束後才開始下降。`,
  resultFail: (p) => `下次挑戰機率提高${p.pct}%p。`,
};
