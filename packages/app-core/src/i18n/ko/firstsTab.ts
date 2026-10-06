// firsts 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  tabRecent: '최근 기록',
  tabRecords: '서버 기록',
  tabTotal: '통산',
  tabSeason: '시즌',
  tabHonor: '수상·우승',
  /** 서버 기록의 단위(골·도움·경기·개·회)를 값 뒤에 붙이는 꼴. 모르는 단위는 그대로 붙인다. */
  unit: (p: { u: string }) => p.u,
};

export type FirstsTabMsgs = typeof ko;
export const firstsTabText = ns('firstsTab', ko);
