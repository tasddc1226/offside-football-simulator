import type { Translation } from '../core';
import type { GameAttrMsgs } from '../ko/gameAttr';

export const gameAttr: Translation<GameAttrMsgs> = {
  title: '能力值',
  legendNow: '目前',
  legendPrev: '賽季開始',
  roleOvr: '各位置 OVR',
  noteBold: '粗體',
  noteRest: (p) => `的能力值決定${p.role}的 OVR。`,
  shareLabel: (p) => `OVR 反映 ${p.pct}%`,
  shareNote: '% 是反映到目前位置 OVR 的比例。',
  growthTitle: '成長緩慢的原因',
};
