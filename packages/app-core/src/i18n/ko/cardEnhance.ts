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
  keep: '유지 확률',
  fail: '실패 확률',
  tierHigh: '최고 OVR 90 이상 카드는 성공 확률이 0.9배예요.',
  tierTop: '최고 OVR 95 이상 카드는 성공 확률이 0.8배예요.',
  newTitle: (p: { names: string }) => `새 칭호를 받았어요: ${p.names}`,
  cost: '비용',
  balance: '구단 자금',
  ovr: (p: { now: number; next: number }) => `강화 OVR +${p.now} → +${p.next}`,
  effectNote:
    '강화 OVR은 구단주 팀의 자리 실력 · 팀 OVR에 더해져요. 선수 커리어 최고 OVR과 기록은 그대로예요.',
  fxLabel: '카드 효과',
  fx1: '잔디',
  fx2: '조명탑',
  fx3: '홍염',
  fx4: '오프사이드 라인',
  fx5: '풀타임',
  fx6: '연장전',
  fx7: '승부차기',
  fx8: '결승전',
  fx9: '우승컵',
  fx10: '마지막 휘슬',
  failNote: (p: { lv: number }) =>
    `실패하면 한 단계 내려가요(+${p.lv}). 유지되면 단계는 그대로예요.`,
  failSafe: '이 단계에서는 실패해도 내려가지 않아요.',
  go: '강화하기',
  going: '강화하는 중…',
  close: '닫기',
  fxSuccess: '강화 성공!',
  fxKeep: '유지',
  fxDown: '하락',
  success: (p: { lv: number }) => `+${p.lv} 강화에 성공했어요.`,
  failKeep: (p: { lv: number }) => `강화되지 않았어요. +${p.lv} 그대로예요.`,
  failDown: (p: { from: number; to: number }) =>
    `강화에 실패해 한 단계 내려갔어요(+${p.from} → +${p.to}).`,
  max: '가장 높은 단계예요.',
  short: '구단 자금이 모자라요.',
  closed: '지금은 카드 강화를 쉬고 있어요.',
  listed: '판매 등록 중인 선수는 강화할 수 없어요.',
  stale: '강화 상태가 바뀌었어요. 새 상태를 불러왔어요.',
  loadFail: '강화 정보를 불러오지 못했어요.',
  retry: '다시 시도',
  tryFail: '강화하지 못했어요. 잠시 후 다시 시도해 주세요.',
  sellNote: (p: { lv: number; value: string }) =>
    `+${p.lv} 강화 가치 ${p.value}${iGa(p.value)} 판매 가격에 더해져요. 최고가 배수는 강화 가치에 붙지 않아요.`,
  lossNote: (p: { n: number }) =>
    `강화한 선수 ${p.n}명이 들어 있어요. 강화 단계는 사라지고, 강화에 쓴 자금은 돌려받지 못해요.`,
};

export type CardEnhanceMsgs = typeof ko;
export const cardEnhanceText = ns('cardEnhance', ko);
