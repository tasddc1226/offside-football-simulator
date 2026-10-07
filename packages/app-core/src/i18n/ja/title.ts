import type { Translation } from '../core';
import type { TitleMsgs } from '../ko/title';

export const title: Translation<TitleMsgs> = {
  newTitles: '新しい称号',
  tagLabel: (p) => `${p.rarity}の称号 ${p.name}`,
  itemLabel: (p) => `${p.rarity}の称号 ${p.name}、${p.desc}`,
  dexTitle: '称号図鑑',
  mainTitle: 'メイン称号',
  selManual: '自分で選択',
  selAuto: '自動',
  pickHint: '称号をタップするとメイン称号になり、選手カードと殿堂に表示されます。',
  earlier: '以前の記録',
  emptyEarned: 'まだ獲得した称号はありません。プロデビューが最初の称号です。',
  lockedSummary: (p) => `未獲得の称号 ${p.n}個`,
  hiddenDesc: '隠し称号',
  progressLabel: (p) => `${p.name}の進行度`,
  pickChanged: (p) => `メイン称号を変更しました：${p.name}`,
  none: 'なし',
  pickOpen: (p) => `獲得した称号${p.n}個から選び直す`,
  pickNote: '選んだ称号は選手カードと殿堂、シェアリンクに表示されます。',
  retiredYear: '引退',
};
