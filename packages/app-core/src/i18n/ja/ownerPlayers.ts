import type { Translation } from '../core';
import type { OwnerPlayersMsgs } from '../ko/ownerPlayers';

export const ownerPlayers: Translation<OwnerPlayersMsgs> = {
  entryLead: 'シーズン別の選手記録を確認し、保有選手を管理できます。',
  openPlayers: '自分の選手を見る',
  menu: '選手管理メニュー',
  records: '選手記録',
  manage: '保有選手の管理',
  viewRecord: '記録を見る',
  noOwned: 'このシーズンの保有選手はいません。育成履歴は選手記録で確認できます。',
  retry: '再試行',
  pickLimit: 'すべて選択（最大50人）',
  title: '自分の選手',
  loading: '読み込み中…',
  sourceAccount: 'アカウントに記録された選手です。ほかの端末でも同じように表示されます。',
  sourceOffline: 'サーバーに接続できなかったため、この端末に保存された選手を表示しています。',
  sourceDeviceWeb:
    'この端末に保存された選手です。Googleアカウントを連携すると、アカウントにまとめて見られます。',
  sourceDeviceApp: 'この端末に保存された選手です。ログインすると、アカウントにまとめて見られます。',
  seasonGroup: 'シーズン',
  tagPublic: '公開',
  openRecord: (p) => `${p.name}の記録を開く`,
  showAll: (p) => `すべて見る（${p.n}人）`,
};
