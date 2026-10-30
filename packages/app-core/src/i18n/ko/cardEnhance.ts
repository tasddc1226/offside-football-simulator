// T-11-373 카드 강화(웹 team/EnhanceSheet.svelte · 앱 screens/owner/EnhanceSheet.tsx · app-core cardEnhance.ts).
import { ns } from '../core';
import { iGa } from '../../format';

const ko = {
  title: '카드 강화',
  open: '강화',
  openAria: (p: { name: string }) => `${p.name} 카드 강화`,
  now: '지금',
  next: '성공하면',
  rate: '성공 확률',
  cost: '비용',
  balance: '구단 자금',
  tries: '시도권',
  triesN: (p: { n: number }) => `${p.n}장`,
  nextTry: (p: { n: number }) => `선발로 ${p.n}경기 더 뛰면 시도권이 1장 생겨요.`,
  triesHow: (p: { n: number }) =>
    `구단주 팀 선발로 랭크 경기를 ${p.n}번 뛸 때마다 그 카드의 시도권이 1장 생겨요.`,
  ovr: (p: { now: number; next: number }) => `강화 OVR +${p.now} → +${p.next}`,
  effectNote:
    '강화 OVR은 구단주 팀의 자리 실력 · 팀 OVR · 급여에 더해져요. 선수 커리어 최고 OVR과 기록은 그대로예요.',
  failStay: '실패해도 단계는 내려가지 않아요.',
  ceiling: (p: { n: number }) => `이 단계에서 ${p.n}번 더 실패하면 다음 시도는 반드시 성공해요.`,
  sure: '이번 시도는 반드시 성공해요.',
  go: '강화하기',
  going: '강화하는 중…',
  close: '닫기',
  success: (p: { lv: number }) => `+${p.lv} 강화에 성공했어요.`,
  failKeep: (p: { lv: number }) => `강화에 실패했어요. +${p.lv} 그대로예요.`,
  max: '가장 높은 단계예요.',
  short: '구단 자금이 모자라요.',
  noTry: '시도권이 없어요.',
  closed: '지금은 카드 강화를 쉬고 있어요.',
  listed: '판매 등록 중인 선수는 강화할 수 없어요.',
  stale: '강화 상태가 바뀌었어요. 새 상태를 불러왔어요.',
  loadFail: '강화 정보를 불러오지 못했어요.',
  retry: '다시 시도',
  tryFail: '강화하지 못했어요. 잠시 후 다시 시도해 주세요.',
  sellNote: (p: { lv: number; value: string }) =>
    `+${p.lv} 강화 가치 ${p.value}${iGa(p.value)} 판매 가격 범위에 더해져요.`,
};

export type CardEnhanceMsgs = typeof ko;
export const cardEnhanceText = ns('cardEnhance', ko);
