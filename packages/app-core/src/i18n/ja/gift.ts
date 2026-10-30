import type { Translation } from '../core';
import type { GiftMsgs } from '../ko/gift';

const itemsOf = (p: { boost: number; scout: number; reroll?: number }) =>
  [
    p.reroll ? `リロール券${p.reroll}枚` : '',
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
  recordTitle: (p) => `シーズン${p.season}の記録報酬が届きました`,
  recordSub: (p) => `シーズン${p.season}の殿堂記録で${itemsOf(p)}を受け取れます。`,
  recordHof: (p) => `殿堂${p.rank}位`,
  recordIcons: (p) => `アイコン${p.n}人`,
  recordLegends: (p) => `レジェンド${p.n}人`,
  recordBallon: (p) => `バロンドール受賞選手${p.n}人`,
  adFreeTitle: '広告削除を先に購入していただきありがとうございます',
  adFreeSub: (p) => `感謝のプレゼントとして${itemsOf(p)}を受け取れます。`,
  doneTitle: 'プレゼントを受け取りました',
  useHint:
    'リロール券は選手作成の候補引き直しで、強化券は選手タブのポテンシャル強化で、スカウト券は選手作成の候補選びで使います。',
  toOwner: 'マイクラブで見る',
};
