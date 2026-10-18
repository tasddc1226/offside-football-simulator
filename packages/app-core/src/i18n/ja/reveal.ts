import type { Translation } from '../core';
import type { RevealMsgs } from '../ko/reveal';

export const reveal: Translation<RevealMsgs> = {
  skip: 'タップですぐ表示',
  shortTitle: '演出を短く',
  shortBody: '選手候補・ポテンシャルの結果を、演出なしですぐに表示します。結果は変わりません。',
  good: '好結果',
  jackpot: '大当たり',
  gradeLive: (p) => (p.tier ? `${p.tier}！${p.text}` : p.text),
  candLive: (p) => `${p.tier ? `${p.tier}！` : ''}候補${p.n} OVR ${p.ovr}`,
};
