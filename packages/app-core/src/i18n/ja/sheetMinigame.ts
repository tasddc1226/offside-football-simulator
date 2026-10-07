import type { Translation } from '../core';
import type { SheetMinigameMsgs } from '../ko/sheetMinigame';

export const sheetMinigame: Translation<SheetMinigameMsgs> = {
  mgEyebrow: 'ワンタッチ · 緑のゾーンで止めてください',
  mgA11y: (p) => `${p.tap}。針が緑のゾーンに来たらタップしてください`,
  late: '時間切れ！',
  saveOk: 'セーブ！',
  saveFail: '失点…',
  goal: 'ゴール！',
  crossbar: 'クロスバー！',
  tooLong: '長すぎた！',
  blocked: '防がれた！',
  dragEyebrow: 'ドラッグシュート · ゴールの方へ引き上げてください',
  dragA11y: 'ドラッグシュート。ボールからゴールの方へドラッグして離すと蹴ります',
  dragHint: 'ゴールの方（上）へもっと長くドラッグしてから離してください',
  dragIdle: '↑ 上へドラッグして離す',
  shotSaved: 'セーブに阻まれた！',
  shotPost: 'ポストを叩いた！',
  shotOver: '空高く浮いた…',
  shotWide: '枠を外れた！',
  lateReadout: (p) => `${p.sec}秒以内に蹴りませんでした`,
  powerWeak: '弱い',
  powerOver: '強すぎ',
  powerGood: '良い',
  readout: (p) => `強さ ${p.power}%（${p.label}）· まっすぐ度 ${p.straight}%`,
};
