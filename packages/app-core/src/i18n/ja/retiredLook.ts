import type { Translation } from '../core';
import type { RetiredLookMsgs } from '../ko/retiredLook';

export const retiredLook: Translation<RetiredLookMsgs> = {
  title: '引退した選手の着せ替え',
  intro: '基本の着せ替えは無料です。記録・能力値・選手の資金は変わりません。',
  policy:
    '引退後の外見は一度だけ無料で変更できます。選手の絵が新しくなったので、以前に変更した選手ももう一度変更できます。移籍歴のある選手は変更できません。',
  used: '新しい選手の絵での外見変更はすでに使用済みです。',
  transferred: '一度でも移籍した選手は、再獲得後も外見を変更できません。',
  checking: '変更できるか確認中',
  checkFailed: '変更できるか確認できませんでした。閉じてから開き直してください。',
  localPartial:
    'この端末に外見と変更回数を保存しましたが、記録画面を更新できませんでした。開き直して確認してください。',
  recordNote: '記録アイテムは、保存された称号の条件を満たすと選べます。',
  retiredPreview: '引退時の姿',
  kitPreview: '選手カードの姿',
  confirm: 'この外見に確定',
  confirmTitle: 'この外見で確定しますか？',
  confirmNote: '確定すると、この選手の外見は二度と変更できません。記録と能力値はそのままです。',
  back: '編集を続ける',
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
