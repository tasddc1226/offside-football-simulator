import type { Translation } from '../core';
import type { FirstsTabMsgs } from '../ko/firstsTab';

export const firstsTab: Translation<FirstsTabMsgs> = {
  tabRecent: '最近の記録',
  tabRecords: 'サーバー記録',
  tabTotal: '通算',
  tabSeason: 'シーズン',
  tabHonor: '受賞・優勝',
  unit: (p) => ({ 골: 'ゴール', 도움: 'アシスト', 경기: '試合', 개: '個', 회: '回' })[p.u] ?? p.u,
};
