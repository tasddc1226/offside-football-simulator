// 잠재력 평가 안내 문구(선수 탭·은퇴 리포트 · app-core potential-view.ts, potential-peek.ts). 스카우트 한마디(scoutHint)는 게임 내용이라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  peekLocked: '첫 시즌을 마치면 스카우트 평가를 볼 수 있어요.',
  peekAvailable: '실제 잠재력은 은퇴할 때 공개돼요. 평가를 보는 것만으로는 잠재력이 바뀌지 않아요.',
  peekShown: (p: { grade: string; year: number }) =>
    `${p.grade}등급 · ${p.year} 시즌 스카우트 평가`,
  peekBtnFree: '이번 시즌 평가 보기',
  peekBtnAd: '광고 보고 이번 시즌 평가 보기',
  peekBtnPay: (p: { cost: string }) => `${p.cost} 내고 이번 시즌 평가 보기`,
  peekShort: (p: { cost: string }) =>
    `자금이 모자라요. 이번 시즌 평가를 보려면 ${p.cost}이 필요해요.`,
  flowTitle: '잠재력이 바뀐 과정',
  flowStart: (p: { grade: string; value: number }) => `처음 실제 잠재력 ${p.grade} (${p.value})`,
  flowDrift: (p: { d: string }) => `25세까지 성장기 변동 ${p.d}`,
  flowBoost: (p: { n: number }) => `잠재력 강화 +${p.n}`,
  flowEnd: (p: { grade: string; value: number }) => `은퇴 시 실제 잠재력 ${p.grade} (${p.value})`,
  seedLine: (p: { seed: number; v: number }) => `커리어 시드 ${p.seed} · 밸런스 버전 ${p.v}`,
  balLine: (p: { v: number }) => `밸런스 버전 ${p.v}`,
  seedNote:
    '이 커리어의 경기와 이벤트 판정은 이 시드에서 이어졌어요. 시드와 밸런스, 선택이 같으면 결과도 같아요.',
};

export type GamePotentialMsgs = typeof ko;
export const gamePotentialText = ns('gamePotential', ko);
