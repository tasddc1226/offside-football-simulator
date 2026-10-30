// T-11-454 웹 결제(엑솔라). T-11-471부터 앱 스토어 묶음(IapPacks)과 같은 자리에 아이템별로 보인다(apps/web ui/cup/WebPayPacks.svelte).
import { ns } from '../core';

const ko = {
  title: '웹에서 사기',
  sub: '카드 · PayPal · 나라별 결제 수단으로 사요. 이 구단주 계정에 바로 들어와요.',
  pack: (p: { item: string; n: number }) =>
    `${{ reroll: '리롤권', boost: '잠재력 강화권', scout: '프리미엄 스카우트권', rename: '선수 이름 변경권' }[p.item] ?? p.item} ${p.n}장`,
  price: (p: { won: string }) => `${p.won}원`,
  priceNote: '결제 화면에서 사는 나라 통화와 세금을 넣은 가격으로 보여요.',
  opening: '결제 화면으로 가는 중…',
  startFail: '결제 화면을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  confirming: '결제를 확인하는 중…',
  done: '결제가 끝나 아이템이 들어왔어요.',
  pending: '결제가 확인되면 아이템이 자동으로 들어와요. 결제하지 않았다면 그대로 두면 돼요.',
  canceled: '환불된 결제라 아이템을 회수했어요.',
  refund:
    '받은 아이템을 쓰지 않았다면 결제일로부터 7일 안에 환불을 요청할 수 있어요. 쓴 아이템은 환불되지 않아요. 문의: contact@offside-lab.com',
};

export type WebPayMsgs = typeof ko;
export const webPayText = ns('webPay', ko);
