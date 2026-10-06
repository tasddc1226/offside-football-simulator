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
};

export type GameAttrMsgs = typeof ko;
export const gameAttrText = ns('gameAttr', ko);
