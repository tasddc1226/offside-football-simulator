import type { Translation } from '../core';
import type { SheetAchieveMsgs } from '../ko/sheetAchieve';

export const sheetAchieve: Translation<SheetAchieveMsgs> = {
  gradeUp: (p) => `晉升為${p.grade}等級`,
  achieved: (p) => `達成了 ${p.n} 項成就`,
  nextGrade: (p) => `距離${p.name}還差 ${p.pts} 分`,
  nextGradeRank: (p) => `距離${p.name}還差 ${p.n} 名`,
  fromTo: (p) => `從${p.from}到${p.to}`,
  more: (p) => `等 ${p.n} 項`,
  gainedPts: (p) => `+${p.n} 分`,
  nowPts: (p) => `目前 ${p.n} 分`,
  reward: (p) => `獲得獎勵：${p.items}`,
  viewAch: '查看成就',
  close: '關閉',
};
