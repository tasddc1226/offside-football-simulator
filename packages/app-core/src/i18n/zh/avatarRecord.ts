import type { Translation } from '../core';
import type { AvatarRecordMsgs } from '../ko/avatarRecord';

export const avatarRecord: Translation<AvatarRecordMsgs> = {
  recTitle: '紀錄道具',
  recIntro: '取得稱號後解鎖的金色道具。一件一件買來穿上吧。',
  recNeed: (p) => `取得「${p.title}」稱號後解鎖`,
  recBuy: (p) => `以 ${p.cost} 購買`,
  recWear: '穿上',
  recOff: '脫下',
  recWorn: '穿戴中',
  recBought: (p) => `已購買並穿上${p.item}。`,
  recScorerBoots: '黃金球鞋',
  recChampBand: '冠軍髮帶',
  recNationWrist: '國家隊護腕',
  recBigearGoggle: '銀色護目鏡',
  recBallonHair: '金色頭髮',
  recWorldcupSocks: '世界冠軍賽球襪',
};
