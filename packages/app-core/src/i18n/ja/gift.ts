import type { Translation } from '../core';
import type { GiftMsgs } from '../ko/gift';

export const gift: Translation<GiftMsgs> = {
  title: 'オーナーへのプレゼントが届きました',
  sub: (p) => `ポテンシャル強化券${p.boost}枚とプレミアムスカウト券${p.scout}枚を受け取れます。`,
  btn: '受け取る',
  busy: '受け取り中…',
  done: (p) => `ポテンシャル強化券${p.boost}枚とプレミアムスカウト券${p.scout}枚を受け取りました。`,
  fail: 'プレゼントを受け取れませんでした。少し待ってからもう一度押してください。',
};
