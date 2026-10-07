// T-11-146 댓글·채팅 "번역 보기" — 웹 Board.svelte·Chat.svelte · 앱 board/Board.tsx·chat/Chat.tsx.
import { ns } from '../core';

const ko = {
  show: '번역 보기',
  original: '원문 보기',
  working: '번역하는 중…',
  note: '자동 번역',
};

export type TranslateMsgs = typeof ko;
export const translateText = ns('translate', ko);
