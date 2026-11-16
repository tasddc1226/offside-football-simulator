// T-11-735 명품 경매(auction.ts) 소식 줄과 소장품 · 등급 이름. 화면 문구는 app-core gameAuction.
import { ns } from '@offside/contracts/i18n';

const ko = {
  watch: '명품 시계',
  car: '클래식 자동차',
  art: '미술품',
  trophy: '트로피 레플리카',
  wine: '빈티지 와인',
  shirt: '기념 유니폼',
  g1: '일반',
  g2: '고급',
  g3: '명품',
  g4: '전설',
  bought: (p: { item: string; grade: string; cost: string; refund: string }) =>
    `경매에서 ${p.item} 상자를 ${p.cost}원에 낙찰받았습니다. 열어 보니 ${p.grade} 등급이었습니다.`,
  dupe: (p: { item: string; grade: string; cost: string; refund: string }) =>
    `경매에서 ${p.item} 상자를 ${p.cost}원에 낙찰받았습니다. 이미 가진 ${p.grade} 등급이라 ${p.refund}원에 되팔았습니다.`,
  complete: (p: { item: string }) => `${p.item} 네 등급을 모두 모아 진열장 한 칸을 채웠습니다.`,
};
export type GAuctionMsgs = typeof ko;
export const gAuctionText = ns('gAuction', ko);
