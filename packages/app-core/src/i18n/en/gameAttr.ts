import type { Translation } from '../core';
import type { GameAttrMsgs } from '../ko/gameAttr';

export const gameAttr: Translation<GameAttrMsgs> = {
  title: 'Attributes',
  legendNow: 'Now',
  legendPrev: 'Season start',
  roleOvr: 'OVR by position',
  noteBold: 'Bold',
  noteRest: (p) => ` attributes decide your ${p.role} OVR.`,
  shareLabel: (p) => `${p.pct}% of OVR`,
  shareNote: 'The % shows how much each attribute counts toward OVR in your current position.',
  growthTitle: 'Why growth is slow',
};
