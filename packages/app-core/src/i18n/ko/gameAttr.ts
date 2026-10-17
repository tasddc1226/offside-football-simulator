// 능력치 카드 문구(웹 AttrCard.svelte · 앱 screens/game/AttrCard.tsx). 능력치·포지션 이름은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  title: '능력치',
  legendNow: '현재',
  legendPrev: '시즌 시작',
  roleOvr: '포지션별 OVR',
  /** 안내 줄 앞쪽 굵은 글씨. */
  noteBold: '굵은 글씨',
  /** 굵은 글씨 뒤에 이어지는 문장. */
  noteRest: (p: { role: string | undefined }) => `가 ${p.role} OVR을 결정하는 능력치예요.`,
  /** T-11-353 항목 머리의 OVR 반영 비율(세부 능력치 줄은 숫자%만). */
  shareLabel: (p: { pct: number }) => `OVR 반영 ${p.pct}%`,
  shareNote: '% 숫자는 지금 포지션 OVR에 반영되는 비율이에요.',
  /** T-11-353 성장을 가장 크게 줄이는 이유 한 줄의 머리말. */
  growthTitle: '성장이 느린 이유',
};

export type GameAttrMsgs = typeof ko;
export const gameAttrText = ns('gameAttr', ko);
