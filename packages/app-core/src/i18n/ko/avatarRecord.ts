// T-11-191 꾸미기의 기록 아이템 칸(칭호를 얻으면 열리는 금빛 아이템). avatarLook 사전은 커리어 화면 첫 청크에 실리므로 따로 둔다.
import { ns } from '../core';
import { withEulReul } from '../../format.js';

const ko = {
  recTitle: '기록 아이템',
  recIntro: '칭호를 얻으면 열리는 금빛 아이템이에요. 하나씩 사서 입어요.',
  recNeed: (p: { title: string }) => `'${p.title}' 칭호를 얻으면 열려요`,
  recBuy: (p: { cost: string }) => `${p.cost}에 사기`,
  recWear: '입기',
  recOff: '벗기',
  recWorn: '입는 중',
  recBought: (p: { item: string }) => `${withEulReul(p.item)} 사서 입었어요.`,
  recScorerBoots: '황금 축구화',
  recChampBand: '우승 헤어밴드',
  recNationWrist: '대표팀 손목 밴드',
  recBigearGoggle: '은빛 고글',
  recBallonHair: '금빛 머리',
  recWorldcupSocks: '월드 챔피언십 양말',
};

export type AvatarRecordMsgs = typeof ko;
export const avatarRecordText = ns('avatarRecord', ko);
