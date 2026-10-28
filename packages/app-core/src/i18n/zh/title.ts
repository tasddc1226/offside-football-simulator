import type { Translation } from '../core';
import type { TitleMsgs } from '../ko/title';

export const title: Translation<TitleMsgs> = {
  newTitles: '新稱號',
  tagLabel: (p) => `${p.rarity}稱號 ${p.name}`,
  itemLabel: (p) => `${p.rarity}稱號 ${p.name}，${p.desc}`,
  dexTitle: '稱號圖鑑',
  mainTitle: '代表稱號',
  selManual: '手動選擇',
  selAuto: '自動',
  mainBadge: '代表',
  pickHint: '點擊稱號即可設為代表稱號，並顯示在球員卡與名人堂。',
  earlier: '先前紀錄',
  emptyEarned: '還沒有獲得稱號。職業出道就是第一個稱號。',
  lockedSummary: (p) => `尚未獲得的稱號 ${p.n} 個`,
  hiddenDesc: '隱藏稱號',
  progressLabel: (p) => `${p.name} 進度`,
  pickChanged: (p) => `已更換代表稱號：${p.name}`,
  none: '無',
  pickOpen: (p) => `從已獲得的 ${p.n} 個稱號中更換`,
  pickNote: '選擇的稱號會顯示在球員卡、名人堂與分享連結。',
  retiredYear: '退役',
};
