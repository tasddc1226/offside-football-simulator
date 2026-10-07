import type { Translation } from '../core';
import type { CupAppMsgs } from '../ko/cupApp';

export const cupApp: Translation<CupAppMsgs> = {
  cancel: 'キャンセル',
  withdrawAskTitle: '申し込みを取り消しますか？',
  withdrawKeep: 'そのままにする',
  actionFail: '処理できませんでした。しばらくしてからもう一度お試しください。',
  groupToggle: (p) => `${p.name}を開く・閉じる`,
  roundToggle: (p) => `${p.name}を開く・閉じる`,
  rerollAskTitle: '候補を引き直しますか？',
  rerollAction: '引き直す',
};
