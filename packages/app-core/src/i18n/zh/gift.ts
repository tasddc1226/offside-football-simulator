import type { Translation } from '../core';
import type { GiftMsgs } from '../ko/gift';

const itemsOf = (p: { boost: number; scout: number; reroll?: number }) =>
  [
    p.reroll ? `重抽券${p.reroll}張` : '',
    p.boost ? `潛力強化券${p.boost}張` : '',
    p.scout ? `高級球探券${p.scout}張` : '',
  ]
    .filter(Boolean)
    .join('、');

export const gift: Translation<GiftMsgs> = {
  btn: '領取',
  busy: '領取中…',
  fail: '無法領取禮物。請稍候再按一次。',
  seasonTitle: (p) => `賽季 ${p.season} 的成就獎勵送到了`,
  seasonSub: (p) => `可以用賽季 ${p.season} 的成就領取${itemsOf(p)}。`,
  seasonDone: (p) => `已領取${itemsOf(p)}。`,
  recordTitle: (p) => `賽季 ${p.season} 的紀錄獎勵送到了`,
  recordSub: (p) => `可以用賽季 ${p.season} 的名人堂紀錄領取${itemsOf(p)}。`,
  recordHof: (p) => `名人堂第${p.rank}名`,
  recordIcons: (p) => `ICON ${p.n} 名`,
  recordLegends: (p) => `傳奇${p.n}名`,
  recordBallon: (p) => `金球獎得主${p.n}名`,
  adFreeTitle: '感謝你搶先購買移除廣告',
  adFreeSub: (p) => `作為感謝禮物，可以領取${itemsOf(p)}。`,
  doneTitle: '已領取禮物',
  useHint:
    '重抽券用於建立球員時重抽候選，強化券用於球員分頁的潛力強化，球探券用於建立球員時挑選候選。',
  toOwner: '在我的俱樂部查看',
};
