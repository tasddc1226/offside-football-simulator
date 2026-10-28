import type { Translation } from '../core';
import type { FirstsTabMsgs } from '../ko/firstsTab';

export const firstsTab: Translation<FirstsTabMsgs> = {
  tabRecent: '最新紀錄',
  tabRecords: '伺服器紀錄',
  tabTotal: '生涯累計',
  tabSeason: '賽季',
  tabHonor: '獎項・冠軍',
  unit: (p) => ({ 골: '球', 도움: '助攻', 경기: '場', 개: '個', 회: '次' })[p.u] ?? p.u,
};
