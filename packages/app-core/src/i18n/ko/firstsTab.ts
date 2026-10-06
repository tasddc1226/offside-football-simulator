// firsts 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  tabRecent: '최근 기록',
  tabRecords: '서버 기록',
  tabTotal: '통산',
  tabSeason: '시즌',
  tabHonor: '수상·우승',
};

export type FirstsTabMsgs = typeof ko;
export const firstsTabText = ns('firstsTab', ko);
