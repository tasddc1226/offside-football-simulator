import type { Translation } from '../core';
import type { GameAttrMsgs } from '../ko/gameAttr';

export const gameAttr: Translation<GameAttrMsgs> = {
  title: 'Attributes',
  roleOvr: 'OVR by position',
  noteBold: 'Bold',
  noteRest: (p) => ` attributes decide your ${p.role} OVR.`,
};
