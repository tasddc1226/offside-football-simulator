// 트로피 탭 문구(웹 tabs/TrophyTab.svelte · 앱 screens/game/TrophyTab.tsx). 우승·수상 이름과 스토리 엔딩은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  empty: '아직 없어요.',
  honours: '우승 연혁',
  individual: '개인 수상',
  ballon: '발롱도르 순위',
  ballonWon: '수상',
  ballonRank: (p: { n: number }) => `${p.n}위`,
  nominees: '30인 후보',
  stories: '완결된 스토리',
};

export type GameTrophyMsgs = typeof ko;
export const gameTrophyText = ns('gameTrophy', ko);
