import type { Translation } from '../core';
import type { AvatarRecordMsgs } from '../ko/avatarRecord';

export const avatarRecord: Translation<AvatarRecordMsgs> = {
  recTitle: 'Record items',
  recIntro: 'Gold items that open when you earn a title. Buy each one to wear it.',
  recNeed: (p) => `Opens with the '${p.title}' title`,
  recBuy: (p) => `Buy for ${p.cost}`,
  recWear: 'Wear',
  recOff: 'Take off',
  recWorn: 'Wearing',
  recBought: (p) => `${p.item} bought and on.`,
  recScorerBoots: 'Golden boots',
  recChampBand: 'Champion headband',
  recNationWrist: 'National team wristband',
  recBigearGoggle: 'Silver goggles',
  recBallonHair: 'Golden hair',
  recWorldcupSocks: 'World Championship socks',
};
