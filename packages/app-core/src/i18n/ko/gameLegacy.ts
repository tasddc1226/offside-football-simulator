// T-11-733 은퇴 유산(선수 탭 카드 · 은퇴 확인 · 은퇴 리포트, app-core legacy-view.ts). 종류 · 등급 이름은 game gLegacy.
import { ns } from '../core';

const ko = {
  title: '은퇴 유산',
  linePick:
    '은퇴할 때 남은 자금으로 무엇을 남길지 골라 두세요. 남은 자금이 많을수록 등급이 올라가요.',
  lineBelow: (p: { need: string }) => `동 등급까지 ${p.need}이 더 필요해요.`,
  lineTierNext: (p: { kind: string; tier: string; next: string; need: string }) =>
    `지금 은퇴하면 ${p.kind} ${p.tier} 등급이에요. ${p.next} 등급까지 ${p.need} 남았어요.`,
  lineTierMax: (p: { kind: string; tier: string }) =>
    `지금 은퇴하면 ${p.kind} ${p.tier} 등급이에요. 가장 높은 등급이에요.`,
  ladderLabel: '등급 기준(남은 자금)',
  itemsLine: (p: { value: string }) =>
    `명품 경매 소장품 가치 ${p.value}도 함께 더해져요. 인기가 높을수록 비싸게 쳐 줘요.`,
  note: '은퇴할 때 남은 자금을 모두 쓰고 종류와 등급이 명예의 전당에 남아요. 금액은 보이지 않아요. 금 등급부터 칭호를 받아요.',
  retireLine: (p: { kind: string; tier: string }) =>
    `은퇴 유산: ${p.kind} ${p.tier} 등급으로 남아요.`,
  retireLineBelow: (p: { kind: string }) => `은퇴 유산(${p.kind})은 동 등급에 못 미쳐 남지 않아요.`,
  creditTitle: '은퇴 유산',
  creditAcademy: '선수 이름을 단 아카데미에서 다음 세대가 공을 차기 시작했어요.',
  creditCharity: '재단이 그라운드 밖에서도 선수 이름을 이어 가요.',
  creditClub: '첫 프로 계약을 맺었던 구단에 받은 만큼 돌려줬어요.',
};

export type GameLegacyMsgs = typeof ko;
export const gameLegacyText = ns('gameLegacy', ko);
