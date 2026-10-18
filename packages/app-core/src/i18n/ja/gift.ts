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
  title: 'オーナーへのプレゼントが届きました',
  sub: (p) => `ポテンシャル強化券${p.boost}枚とプレミアムスカウト券${p.scout}枚を受け取れます。`,
  btn: '受け取る',
  busy: '受け取り中…',
  done: (p) => `ポテンシャル強化券${p.boost}枚とプレミアムスカウト券${p.scout}枚を受け取りました。`,
  fail: 'プレゼントを受け取れませんでした。少し待ってからもう一度押してください。',
  seasonTitle: (p) => `シーズン${p.season}の実績報酬が届きました`,
  seasonSub: (p) => `シーズン${p.season}の実績で${itemsOf(p)}を受け取れます。`,
  seasonDone: (p) => `${itemsOf(p)}を受け取りました。`,
};
