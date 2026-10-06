// 시즌 탭 문구(웹 tabs/SeasonTab.svelte · 앱 screens/game/SeasonTab.tsx). 구간 이름(PHASES)·훈련·자기 투자·스토리 이름과 설명은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  preseason: '프리시즌',
  prepTitle: '다음 구간 준비',
  condition: '컨디션',
  morale: '사기',
  fame: '인기',
  coachMemo: '코치 메모',
  trainingTitle: '훈련 방향',
  trainHint: '이번 구간 훈련을 고르면 다음으로 넘어가요',
  investTitle: '자기 투자',
  funds: (p: { v: string }) => `보유 ${p.v}`,
  investHint: '투자를 고르면 넘어가요 · 아끼려면 투자 안 함',
  phaseFirst: '전반기',
  phaseSecond: '후반기',
  totals: (p: {
    w: number;
    d: number;
    l: number;
    apps: number;
    goals: number;
    col: string;
    colN: number;
    rating: string;
  }) =>
    `시즌 누적 · ${p.w}승 ${p.d}무 ${p.l}패 · 출전 ${p.apps} · ${p.goals}골 · ${p.col} ${p.colN} · 평점 ${p.rating}`,
  colCs: '무실점',
  colAssists: '도움',
  compsTitle: '이번 시즌 대회',
  compSuper: '개막 전 단판',
  compStart: '1구간 시작',
  compAlive: '진행 중',
  compLine: (p: { apps: number; g: number }) => `${p.apps}경기 ${p.g}골`,
  storiesTitle: '진행 중인 스토리',
  storySoon: '곧 이어짐',
  storyWait: (p: { n: number }) => `약 ${p.n}구간 후`,
  feedTitle: '최근 소식',
  feedLess: '접기',
  feedMore: '더 보기',
  feedLessAria: '최근 소식 접기',
  feedMoreAria: '최근 소식 더 보기',
};

export type GameSeasonMsgs = typeof ko;
export const gameSeasonText = ns('gameSeason', ko);
