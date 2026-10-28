import type { Translation } from '../core';
import type { RevealMsgs } from '../ko/reveal';

export const reveal: Translation<RevealMsgs> = {
  skip: '點一下直接查看',
  shortTitle: '縮短演出',
  shortBody: '公開球員候選與潛力結果時不播放演出，直接顯示結果。結果不會改變。',
  good: '好結果',
  jackpot: '大獎',
  gradeLive: (p) => (p.tier ? `${p.tier}！${p.text}` : p.text),
  candLive: (p) => `${p.tier ? `${p.tier}！` : ''}候選 ${p.n} OVR ${p.ovr}`,
};
