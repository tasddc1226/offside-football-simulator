// T-11-834 크리스마스 이벤트(웹 HomeXmas.svelte · 앱 screens/home/HomeXmas.tsx). 지연 청크에서만 불러 첫 화면 번들에 넣지 않는다.
import { ns } from '../core';

const ko = {
  title: '크리스마스 첫걸음 양말',
  sub: '처음 하는 일 세 가지로 양말을 열어요',
  dday: (p: { n: number }) => (p.n > 0 ? `D-${p.n}` : '마지막 날'),
  until: '1월 4일까지',
  sockStart: '첫 시즌 마치기',
  sockRetire: '선수 은퇴시키기',
  sockTeam: '구단주 팀 만들기',
  sockStartHint: '새 커리어로 첫 시즌을 끝까지 치르면 열려요.',
  sockRetireHint: '나이와 상관없이 선수를 은퇴시키면 열려요.',
  sockTeamHint: '로그인하고 구단주 팀을 만들면 열려요. 한정 칭호도 같이 받아요.',
  stateClaimed: '받았어요',
  stateReady: '받기',
  stateTodo: '아직',
  stateLogin: '로그인',
  goCareer: '이어서 커리어 하기',
  goStart: '커리어 시작하기',
  goTeam: '구단주 팀 만들기',
  loginLead: '양말과 트리 보상은 로그인한 구단주만 받아요. 진행은 로그인하기 전에도 쌓여요.',
  got: (p: { reward: string }) => `양말을 열었어요. ${p.reward}`,
  gotTree: (p: { pct: number; reward: string }) => `트리 ${p.pct}% 보상을 받았어요. ${p.reward}`,
  gotTitle: '한정 칭호 "2026 크리스마스"를 받았어요. 명예관에서 대표 칭호로 달 수 있어요.',
  fail: '받지 못했어요. 잠시 뒤 다시 눌러 주세요.',
  treeTitle: '다 함께 트리 채우기',
  treeEntry: (p: { pct: number }) => `${p.pct}% 채웠어요`,
  treeLead: '모두가 은퇴시킨 선수만큼 트리에 불이 켜져요. 12월 25일까지 세요.',
  treeCount: (p: { count: string; goal: string }) => `은퇴 커리어 ${p.count} / ${p.goal}`,
  treeMine: (p: { n: number }) => `내가 보탠 커리어 ${p.n}개`,
  treeClosed: '트리는 마감했어요. 채운 단계 보상은 1월 4일까지 받아요.',
  stepClaim: (p: { pct: number }) => `${p.pct}% 보상 받기`,
  stepAria: (p: { pct: number; reward: string; state: string }) =>
    `${p.pct}% 단계, ${p.reward}, ${p.state}`,
  stepReached: '닿았어요',
  stepLocked: '아직',
  close: '닫기',
  inviteDouble: '크리스마스 기간(1월 4일까지)에는 친구 초대 보상이 2배예요.',
};

export type XmasMsgs = typeof ko;
export const xmasText = ns('xmas', ko);
