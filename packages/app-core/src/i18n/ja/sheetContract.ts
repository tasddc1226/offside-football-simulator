import type { Translation } from '../core';
import type { SheetContractMsgs } from '../ko/sheetContract';

export const sheetContract: Translation<SheetContractMsgs> = {
  close: '契約書を閉じる',
  padLabel: '選手のサイン入力エリア',
  signHint: 'ここにサインしてください',
  signNote: 'ゲーム内の選手の架空のサインです',
  clear: '書き直す',
  nameSign: '名前のサインを使う',
  flightA11y: (p) => `${p.from}から${p.to}までの飛行ルート`,
};
