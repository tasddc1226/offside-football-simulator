// 웹 게임 화면이 게임 값에 붙이는 작은 문구(T-11-106). 게임 화면(지연 청크)에서만 읽는다 — 첫 화면 모듈은 쓰지 않는다.
import { ns } from '../core';

const ko = {
  /** fmtMoney가 돌려준 금액 뒤에 붙이는 단위. */
  won: (p: { v: string }) => `${p.v}원`,
};
export type WebGameMsgs = typeof ko;
export const webGameText = ns('webGame', ko);
