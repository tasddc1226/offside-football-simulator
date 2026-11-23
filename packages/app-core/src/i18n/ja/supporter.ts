import type { Translation } from '../core';
import type { SupporterMsgs } from '../ko/supporter';

export const supporter: Translation<SupporterMsgs> = {
  pill: (p) => (p.tier > 1 ? `サポーター${p.tier}か月` : 'サポーター'),
  label: (p) =>
    p.tier > 1
      ? `クラブメンバーシップ ${p.tier}か月連続サポーター`
      : 'クラブメンバーシップ サポーター',
};
