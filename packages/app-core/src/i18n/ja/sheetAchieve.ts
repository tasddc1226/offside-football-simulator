import type { Translation } from '../core';
import type { SheetAchieveMsgs } from '../ko/sheetAchieve';

export const sheetAchieve: Translation<SheetAchieveMsgs> = {
  gradeUp: (p) => `${p.grade}ランクになりました`,
  achieved: (p) => `実績を${p.n}個達成しました`,
  nextGrade: (p) => `${p.name}まであと${p.pts}点`,
  fromTo: (p) => `${p.from}から${p.to}へ`,
  more: (p) => `ほか${p.n}個`,
  gainedPts: (p) => `+${p.n}点`,
  nowPts: (p) => `現在${p.n}点`,
  viewAch: '実績を見る',
  close: '閉じる',
};
