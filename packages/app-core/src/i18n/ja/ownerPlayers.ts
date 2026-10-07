import type { Translation } from '../core';
import type { OwnerPlayersMsgs } from '../ko/ownerPlayers';

export const ownerPlayers: Translation<OwnerPlayersMsgs> = {
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
