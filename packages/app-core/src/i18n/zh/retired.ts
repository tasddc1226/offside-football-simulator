import type { Translation } from '../core';
import type { RetiredMsgs } from '../ko/retired';

export const retired: Translation<RetiredMsgs> = {
  newCareer: '開啟新生涯 →',
  myClub: '建立我的球隊',
  seeHof: '查看名人堂',
  play: '重播生涯',
  stop: '暫停',
  cohortTitle: (p) => `在第 ${p.season} 賽季退役的 ${p.n} 名${p.pos}中`,
  cohortTop: (p) => `前 ${p.pct}%`,
  cohortNote: '紀錄每天統計一次。',
  cohortScore: '傳奇分數',
  cohortPeak: '最高 OVR',
  cohortApps: '生涯出場',
  cohortGoals: '生涯進球',
  cohortAssists: '生涯助攻',
  cohortTrophies: '獎盃',
  cohortCaps: '國家隊出場',
  cohortBallon: '金球獎',
};
