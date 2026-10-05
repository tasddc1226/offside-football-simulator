import type { Translation } from '../core';
import type { SheetAchieveMsgs } from '../ko/sheetAchieve';

export const sheetAchieve: Translation<SheetAchieveMsgs> = {
  gradeUp: (p) => `You reached ${p.grade} grade`,
  achieved: (p) => `You unlocked ${p.n} achievement${p.n === 1 ? '' : 's'}`,
  nextGrade: (p) => `${p.pts} pts to ${p.name}`,
  fromTo: (p) => `From ${p.from} to ${p.to}`,
  more: (p) => `+${p.n} more`,
  gainedPts: (p) => `+${p.n} pts`,
  nowPts: (p) => `${p.n} pts now`,
  viewAch: 'View achievements',
  close: 'Close',
};
