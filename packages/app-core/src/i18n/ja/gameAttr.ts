import type { Translation } from '../core';
import type { GameAttrMsgs } from '../ko/gameAttr';

export const gameAttr: Translation<GameAttrMsgs> = {
  title: '能力値',
  legendNow: '現在',
  legendPrev: 'シーズン開始',
  roleOvr: 'ポジション別OVR',
  noteBold: '太字',
  noteRest: (p) => `の能力値が${p.role}のOVRを決めます。`,
  shareLabel: (p) => `OVR反映 ${p.pct}%`,
  shareNote: '%は今のポジションのOVRに反映される割合です。',
  growthTitle: '成長が遅い理由',
};
