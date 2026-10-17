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
  left: (p: { n: number }) => `오늘 ${p.n}번 더 할 수 있어요`,
  failStay: '실패해도 단계는 그대로예요.',
  failDrop: (p: { lv: number }) => `실패하면 +${p.lv} 단계로 내려가요.`,
  pity: (p: { n: number }) => `연속 실패 ${p.n}번이라 확률이 올랐어요.`,
  effect: (p: { now: string; next: string }) => `경기 자리 능력치 +${p.now} → +${p.next}`,
  effectNote:
    '강화는 구단주 팀 경기의 자리 능력치에만 더해져요. 카드 OVR과 팀 OVR 표시는 그대로예요.',
  go: '강화하기',
  going: '강화하는 중…',
  skip: '건너뛰기',
  close: '닫기',
  success: (p: { lv: number }) => `+${p.lv} 강화에 성공했어요.`,
  failKeep: (p: { lv: number }) => `강화에 실패했어요. +${p.lv} 그대로예요.`,
  failDropped: (p: { lv: number }) => `강화에 실패해 +${p.lv} 단계로 내려갔어요.`,
  max: '가장 높은 단계예요.',
  short: '구단 자금이 모자라요.',
  limit: '오늘 강화 횟수를 다 썼어요.',
  closed: '지금은 카드 강화를 쉬고 있어요.',
  listed: '판매 등록 중인 선수는 강화할 수 없어요.',
  loadFail: '강화 정보를 불러오지 못했어요.',
  retry: '다시 시도',
  tryFail: '강화하지 못했어요. 잠시 후 다시 시도해 주세요.',
  sellNote: (p: { lv: number; value: string }) =>
    `+${p.lv} 강화 가치 ${p.value}${iGa(p.value)} 판매 가격 범위에 더해져요.`,
};

export type CardEnhanceMsgs = typeof ko;
export const cardEnhanceText = ns('cardEnhance', ko);
