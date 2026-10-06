// 게임 화면 문구(웹 Game.svelte · 앱 screens/game/Game.tsx · app-core seasonAction.ts). 역할(주전 등)·능력치·구단·리그 이름은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  menuLabel: '게임 메뉴',
  tabSeason: '시즌',
  tabPlayer: '선수',
  tabCareer: '커리어',
  tabTrophy: '트로피',
  tabHome: '홈',
  age: (p: { n: number }) => `${p.n}세`,
  salary: (p: { v: string }) => `연봉 ${p.v}`,
  amateur: '아마추어',
  value: (p: { v: string }) => `몸값 ${p.v}`,
  focus: (p: { names: string }) => `주력 ${p.names}`,
  injury: (p: { n: number }) => `부상 ${p.n}경기`,
  titleOpen: (p: { name: string }) => `대표 칭호 ${p.name}, 칭호 도감 열기`,
  prepOpen: (p: { prep: string }) => `다음 구간 준비 보기: ${p.prep}`,
  storageFull: '저장 공간이 부족해 진행 상황을 저장하지 못했어요. 설정에서 백업해 두세요.',
  // 아래 고정 진행 바(seasonAction.ts)
  actEvent: '⚡ 이벤트 확인',
  actSeasonEnd: '시즌 결산 보기',
  actPreseason: '프리시즌 훈련 진행',
  actPlay: (p: { n: number }) => `훈련 후 ${p.n}경기 진행`,
  prep: (p: { train: string; invest: string; cond: number }) =>
    `훈련 ${p.train} · 투자 ${p.invest} · 컨디션 ${p.cond}`,
  investNone: '없음',
};

export type GameMsgs = typeof ko;
export const gameText = ns('game', ko);
