import type { Translation } from '../core';
import type { CupAppMsgs } from '../ko/cupApp';

export const cupApp: Translation<CupAppMsgs> = {
  cancel: '取消',
  withdrawAskTitle: '要取消報名嗎？',
  withdrawKeep: '保持報名',
  actionFail: '處理失敗，請稍後再試。',
  groupToggle: (p) => `展開・收合${p.name}`,
  roundToggle: (p) => `展開・收合${p.name}`,
  rerollAskTitle: '要重新抽候選嗎？',
  rerollAction: '重新抽',
  shopAskTitle: '要購買重抽券嗎？',
  shopAction: '購買',
};
