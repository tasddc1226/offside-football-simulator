// 계약서 사인·해외 이적 비행 시트(웹 ui/sheets/{Contract,Flight}.svelte · 앱 sheets/{Contract,Flight}.tsx).
import { ns } from '../core';

const ko = {
  close: '계약서 닫기',
  padLabel: '선수 사인 입력 영역',
  signHint: '이곳에 사인해 주세요',
  signNote: '게임 속 선수의 가상 사인이에요',
  clear: '다시 쓰기',
  nameSign: '이름 사인 사용',
  flightA11y: (p: { from: string; to: string }) => `${p.from}에서 ${p.to}까지 비행 경로`,
};

export type SheetContractMsgs = typeof ko;
export const sheetContractText = ns('sheetContract', ko);
