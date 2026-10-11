import type { Translation } from '../core';
import type { GameAttrMsgs } from '../ko/gameAttr';

export const gameAttr: Translation<GameAttrMsgs> = {
  title: '能力値',
  roleOvr: 'ポジション別OVR',
  noteBold: '太字',
  noteRest: (p) => `の能力値が${p.role}のOVRを決めます。`,
};
