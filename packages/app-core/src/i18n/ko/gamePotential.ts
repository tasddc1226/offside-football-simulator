// 잠재력 평가 안내 문구(선수 탭·은퇴 리포트 · app-core potential-view.ts, potential-peek.ts). 스카우트 한마디(scoutHint)는 게임 내용이라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  peekLocked: '첫 시즌을 마치면 스카우트 평가를 볼 수 있어요.',
  peekAvailable: '실제 잠재력은 은퇴할 때 공개돼요.',
  peekShown: (p: { grade: string; year: number }) =>
    `${p.grade}등급 · ${p.year} 시즌 스카우트 평가`,
  peekBtnFree: '이번 시즌 평가 보기',
  peekBtnAd: '광고 보고 이번 시즌 평가 보기',
};

export type GamePotentialMsgs = typeof ko;
export const gamePotentialText = ns('gamePotential', ko);
