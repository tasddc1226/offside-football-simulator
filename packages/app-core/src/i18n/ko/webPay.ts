// T-11-454 웹 결제(토스페이먼츠) — 웹 구단주 화면 상점(apps/web ui/cup/WebPayShop.svelte).
import { ns } from '../core';

const ko = {
  title: '웹에서 사기',
  sub: '카드 · 간편결제로 사요. 이 구단주 계정에 바로 들어와요.',
  pack: (p: { item: string; n: number }) =>
    `${{ reroll: '리롤권', boost: '잠재력 강화권', scout: '프리미엄 스카우트권', rename: '선수 이름 변경권' }[p.item] ?? p.item} ${p.n}장`,
  price: (p: { won: string }) => `${p.won}원`,
  pay: (p: { won: string }) => `${p.won}원 결제하기`,
  cancel: '닫기',
  opening: '결제창을 여는 중…',
  startFail: '결제창을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  canceled: '결제를 취소했어요.',
  failed: '결제하지 못했어요. 결제 수단을 확인하고 다시 시도해 주세요.',
  confirming: '결제를 확인하는 중…',
  done: '결제가 끝나 아이템이 들어왔어요.',
  claimFail: '결제는 끝났어요. 받는 중에 문제가 생겼어요. 구단주 화면을 다시 열면 다시 받아요.',
  refund:
    '받은 아이템을 쓰지 않았다면 결제일로부터 7일 안에 환불을 요청할 수 있어요. 쓴 아이템은 환불되지 않아요. 문의: contact@offside-lab.com',
  shopWeb: '아래 웹에서 사기에서 살 수 있어요.',
};

export type WebPayMsgs = typeof ko;
export const webPayText = ns('webPay', ko);
