import type { Translation } from '../core';
import type { AvatarRecordMsgs } from '../ko/avatarRecord';

export const avatarRecord: Translation<AvatarRecordMsgs> = {
  recTitle: '記録アイテム',
  recIntro: '称号を獲得すると開く金色のアイテムです。一つずつ買って身につけます。',
  recNeed: (p) => `「${p.title}」の称号で開きます`,
  recBuy: (p) => `${p.cost}で買う`,
  recWear: '着ける',
  recOff: '外す',
  recWorn: '着用中',
  recBought: (p) => `${p.item}を買って着けました。`,
  recScorerBoots: '黄金のスパイク',
  recChampBand: '優勝ヘアバンド',
  recNationWrist: '代表チームのリストバンド',
  recBigearGoggle: '銀のゴーグル',
  recBallonHair: '金色の髪',
  recWorldcupSocks: 'ワールドカップのソックス',
};
