// 칭호 화면 문구(웹 ui/titles/* · 앱 TitleDex·TitleTag·NewTitles·TitlePickCard). 칭호 이름·설명·등급 이름은 게임(packages/game)이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  /** 구간 리포트·시즌 결산의 '새 칭호' 줄 제목. */
  newTitles: '새 칭호',
  /** 칭호 알약의 접근성 이름(앱). */
  tagLabel: (p: { rarity: string; name: string }) => `${p.rarity} 칭호 ${p.name}`,
  /** 칭호 도감 목록 줄의 접근성 이름(앱). */
  itemLabel: (p: { rarity: string; name: string; desc: string }) =>
    `${p.rarity} 칭호 ${p.name}, ${p.desc}`,
  dexTitle: '칭호 도감',
  mainTitle: '대표 칭호',
  selManual: '직접 고름',
  selAuto: '자동',
  pickHint: '칭호를 누르면 대표 칭호로 정해져 선수 카드와 명예의 전당에 표시돼요.',
  earlier: '이전 기록',
  emptyEarned: '아직 얻은 칭호가 없어요. 프로 데뷔가 첫 번째 칭호예요.',
  lockedSummary: (p: { n: number }) => `아직 얻지 못한 칭호 ${p.n}개`,
  hiddenDesc: '숨겨진 칭호',
  progressLabel: (p: { name: string }) => `${p.name} 진행도`,
  // 은퇴한 선수의 대표 칭호 고르기
  pickChanged: (p: { name: string }) => `대표 칭호를 바꿨어요: ${p.name}`,
  none: '없음',
  pickOpen: (p: { n: number }) => `받은 칭호 ${p.n}개 중에서 바꾸기`,
  pickNote: '고른 칭호는 선수 카드와 명예의 전당·공유 링크에 표시돼요.',
};

export type TitleMsgs = typeof ko;
export const titleText = ns('title', ko);
