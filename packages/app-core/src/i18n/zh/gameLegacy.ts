import type { Translation } from '../core';
import type { GameLegacyMsgs } from '../ko/gameLegacy';

export const gameLegacy: Translation<GameLegacyMsgs> = {
  title: '退休遺產',
  linePick: '先選好退休時要用剩下的資金留下什麼。剩下的資金越多，等級越高。',
  lineBelow: (p) => `還需要${p.need}才能達到銅等級。`,
  lineTierNext: (p) => `現在退休的話是${p.kind}・${p.tier}等級。距離${p.next}等級還差${p.need}。`,
  lineTierMax: (p) => `現在退休的話是${p.kind}・${p.tier}等級，已是最高等級。`,
  ladderLabel: '等級標準（剩餘資金）',
  itemsLine: (p: { value: string }) => `拍賣收藏品價值${p.value}也會一併計入。人氣越高，估價越高。`,
  note: '退休時會用掉所有剩餘資金，種類和等級會留在名人堂。不會顯示金額。金等級起可獲得稱號。',
  retireLine: (p) => `退休遺產：以${p.kind}・${p.tier}等級留下。`,
  retireLineBelow: (p) => `遺產（${p.kind}）未達銅等級，不會留下。`,
  creditTitle: '退休遺產',
  creditAcademy: '在以球員命名的學院裡，下一代開始踢球了。',
  creditCharity: '基金會在球場外延續著球員的名字。',
  creditClub: '回饋了簽下第一份職業合約的球隊。',
};
