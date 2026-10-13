// sheetPlay 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  skip: '건너뛰기',
  // 경기 중계 집계
  tallyApps: '출전',
  tallyGoals: '골',
  tallyCleanSheets: '무실점',
  tallyAssists: '도움',
  tallyRating: '평점',
  wdl: (p: { w: number; d: number; l: number }) => `${p.w}승 ${p.d}무 ${p.l}패`,
  // 경기 한 줄
  tickerMins: (p: { n: number }) => `${p.n}분`,
  tickerGoals: (p: { n: number }) => `${p.n}골`,
  tickerAssists: (p: { n: number }) => `${p.n}도움`,
  tickerInjured: '부상 결장',
  tickerNone: '출전 없음',
  // 판정
  judging: '판정 중',
  judgeOk: (p: { pct: number }) => `성공 ${p.pct}%`,
  judgeFail: (p: { pct: number }) => `실패 ${p.pct}%`,
};

export type SheetCoreMsgs = typeof ko;
export const sheetCoreText = ns('sheetCore', ko);
