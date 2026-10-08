// 구단 자금 내역(웹 FundsHistory.svelte · 앱 screens/owner/FundsHistory.tsx).
import { ns } from '../core';

const ko = {
  eyebrow: 'Club funds',
  title: '구단 자금 내역',
  balance: '지금 구단 자금',
  income: '들어온 자금',
  spending: '나간 자금',
  released: '방출',
  sold: '판매',
  fees: (p: { fee: string }) => `수수료 ${p.fee} 뺌`,
  bought: '영입',
  spent: '구단 자금 사용',
  log: '내역',
  empty:
    '아직 구단 자금이 오간 적이 없어요. 키운 선수를 방출하거나 이적시장에서 팔면 자금이 생겨요.',
  more: '더 보기',
  loadFail: '내역을 불러오지 못했어요.',
  retry: '다시 시도',
  date: (p: { m: number; d: number }) => `${p.m}월 ${p.d}일`,
  openAria: '구단 자금 내역 보기',
};

export type FundsHistoryMsgs = typeof ko;
export const fundsHistoryText = ns('fundsHistory', ko);
