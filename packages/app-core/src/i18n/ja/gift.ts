import type { Translation } from '../core';
import type { GiftMsgs } from '../ko/gift';

const itemsOf = (p: { boost: number; scout: number }) =>
  [
    p.boost ? `ポテンシャル強化券${p.boost}枚` : '',
    p.scout ? `プレミアムスカウト券${p.scout}枚` : '',
  ]
    .filter(Boolean)
    .join('と');

export const gift: Translation<GiftMsgs> = {
  btn: '受け取る',
  busy: '受け取り中…',
  fail: 'プレゼントを受け取れませんでした。少し待ってからもう一度押してください。',
  seasonTitle: (p) => `シーズン${p.season}の実績報酬が届きました`,
  seasonSub: (p) => `シーズン${p.season}の実績で${itemsOf(p)}を受け取れます。`,
  seasonDone: (p) => `${itemsOf(p)}を受け取りました。`,
  doneTitle: 'プレゼントを受け取りました',
  useHint: '強化券は選手タブのポテンシャル強化で、スカウト券は選手作成の候補選びで使います。',
  toOwner: 'マイクラブで見る',
};
