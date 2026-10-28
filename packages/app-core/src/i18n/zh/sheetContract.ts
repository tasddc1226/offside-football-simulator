import type { Translation } from '../core';
import type { SheetContractMsgs } from '../ko/sheetContract';

export const sheetContract: Translation<SheetContractMsgs> = {
  close: '關閉合約',
  padLabel: '球員簽名區',
  signHint: '請在這裡簽名',
  signNote: '這是遊戲中球員的虛構簽名',
  clear: '重寫',
  nameSign: '使用名字簽名',
  flightA11y: (p) => `從${p.from}到${p.to}的飛行路線`,
};
