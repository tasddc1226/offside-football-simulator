// T-11-371 팩 오픈식 결과 공개 연출 문구(웹 RevealFx.svelte · Create.svelte · Settings.svelte · 앱 RevealFx.tsx · Create.tsx · Settings.tsx).
import { ns } from '../core';

const ko = {
  skip: '눌러서 바로 보기',
  shortTitle: '연출 짧게',
  shortBody: '선수 후보 · 잠재력 결과를 공개할 때 연출 없이 결과만 짧게 보여요. 결과는 같아요.',
  good: '좋은 결과',
  jackpot: '대박',
  /** 화면 읽기: 결과 단계에서 한 번만 읽는다. */
  gradeLive: (p: { text: string; tier: string }) => (p.tier ? `${p.tier}! ${p.text}` : p.text),
  candLive: (p: { n: number; ovr: number; tier: string }) =>
    `${p.tier ? `${p.tier}! ` : ''}후보 ${p.n} OVR ${p.ovr}`,
};

export type RevealMsgs = typeof ko;
export const revealText = ns('reveal', ko);
