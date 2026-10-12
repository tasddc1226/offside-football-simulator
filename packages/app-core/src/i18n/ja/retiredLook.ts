import type { Translation } from '../core';
import type { RetiredLookMsgs } from '../ko/retiredLook';

export const retiredLook: Translation<RetiredLookMsgs> = {
  title: '引退した選手の着せ替え',
  intro: '基本の着せ替えは無料です。記録・能力値・選手の資金は変わりません。',
  recordNote: '記録アイテムは、保存された称号の条件を満たすと選べます。',
  retiredPreview: '引退時の姿',
  kitPreview: '選手カードの姿',
  save: '外見を保存',
  saving: '保存中',
  cancel: 'キャンセル',
  reset: '初期の姿',
  saved: '外見を保存しました。記録と能力値は変わりません。',
  localSaved: 'この端末に外見を保存しました。サーバーに記録がない引退選手です。',
  serverSaved:
    'サーバーに外見を保存しましたが、端末への保存に失敗しました。開き直して確認してください。',
  storageFailed: '端末に保存できませんでした。空き容量を確認してください。',
  failed: '外見を保存できませんでした。もう一度お試しください。',
};
