// T-11-735 선수 탭 '명품 경매' 카드 · 결과 연출 · 은퇴 리포트 장면(웹 PlayerTab.svelte · 앱 PlayerTab.tsx · app-core auction-view.ts).
// 소장품 · 등급 이름은 game gAuction에 있다. 금액은 부르는 쪽이 서식을 맞춰 넘긴다.
import { ns } from '../core';

const ko = {
  title: '명품 경매',
  line: (p: { cost: string }) =>
    `이번 시즌 경매품이 올라왔어요. 하나에 ${p.cost}이고, 상자를 열어야 등급을 알 수 있어요.`,
  lineDone: '이번 시즌 경매품을 모두 샀어요. 다음 시즌에 새 경매품이 올라와요.',
  buy: '낙찰',
  got: '낙찰 완료',
  short: '자금 부족',
  confirm: (p: { item: string; cost: string }) =>
    `${p.item} 상자를 ${p.cost}에 살까요? 등급은 열어 봐야 알 수 있어요.`,
  confirmBtn: '낙찰받기',
  cancel: '취소',
  odds: (p: { g1: number; g2: number; g3: number; g4: number }) =>
    `등급 확률: 일반 ${p.g1}% · 고급 ${p.g2}% · 명품 ${p.g3}% · 전설 ${p.g4}%`,
  note: '소장품마다 가치가 매겨지고, 은퇴할 때 은퇴 유산에 더해져요(인기가 높을수록 비싸게 쳐 줘요). 한 종류 네 등급을 모으면 세트 효과로 경기력이 조금 올라요. 겹친 소장품은 산 값의 절반에 되팔아요. 은퇴하면 대표 소장품 3개가 명예의 전당에 남아요.',
  adButton: '경매품 새로 받기',
  adBadge: '광고',
  adNote: '광고를 보면 이번 시즌 경매품을 새로 받을 수 있어요(시즌에 한 번).',
  adNoteFree: '광고 제거로 이번 시즌 경매품을 새로 받을 수 있어요(시즌에 한 번).',
  adWatch: '광고를 끝까지 보면 경매품을 새로 받을 수 있어요.',
  refreshed: '새 경매품이 올라왔어요.',
  shelfWorth: (p: { value: string; sets: number }) =>
    p.sets ? `가치 ${p.value} · 세트 ${p.sets}` : `가치 ${p.value}`,
  shelfTitle: '진열장',
  shelfCount: (p: { n: number; total: number }) => `소장품 ${p.n}/${p.total}`,
  shelfLabel: (p: { item: string; grade: string; on: boolean }) =>
    `${p.item} ${p.grade} ${p.on ? '소장' : '없음'}`,
  rolling: '상자를 여는 중…',
  resultTitle: (p: { item: string; grade: string }) => `${p.grade} ${p.item}`,
  resultNew: (p: { value: string }) => `진열장에 새 소장품이 들어왔어요. 가치 ${p.value}.`,
  resultDupe: (p: { refund: string }) => `이미 가진 소장품이라 ${p.refund}에 되팔았어요.`,
  resultComplete: (p: { item: string }) =>
    `${p.item} 네 등급을 모두 모았어요. 세트 효과로 경기력이 조금 올라요.`,
  close: '확인',
  creditTitle: '대표 소장품',
};
export type GameAuctionMsgs = typeof ko;
export const gameAuctionText = ns('gameAuction', ko);
