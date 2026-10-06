import type { Translation } from '../core';
import type { GameAttrMsgs } from '../ko/gameAttr';

export const gameAttr: Translation<GameAttrMsgs> = {
  title: 'Attributes',
  legendNow: 'Now',
  legendPrev: 'Season start',
  roleOvr: 'OVR by position',
  noteBold: 'Bold',
  noteRest: (p) => ` attributes decide your ${p.role} OVR.`,
};
