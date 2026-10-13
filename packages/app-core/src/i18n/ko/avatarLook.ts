// T-11-191 도트 선수 꾸미기(웹 AvatarLook.svelte · 앱 screens/game/AvatarLook.tsx · app-core avatarLook.ts).
import { ns } from '../core';
import { withEulReul } from '../../format.js';

const ko = {
  open: '선수 꾸미기 열기',
  /** 커리어 화면 도트 선수 오른쪽 아래 칩(누를 수 있다는 표시). */
  chip: '꾸미기',
  title: '선수 꾸미기',
  intro:
    '선수 자금으로 항목을 한 번 사면 이 커리어 동안 언제든 바꿀 수 있어요. 은퇴 뒤에는 이적 이력이 없는 선수만 은퇴 리포트에서 한 번 바꿀 수 있어요.',
  locked: '은퇴 리포트의 꾸미기 버튼을 이용해 주세요.',
  money: (p: { money: string }) => `선수 자금 ${p.money}`,
  owned: '보유',
  buy: (p: { item: string; cost: string }) => `${p.item} ${p.cost}에 사기`,
  short: (p: { cost: string }) => `자금이 모자라요. ${p.cost}이 필요해요.`,
  bought: (p: { item: string }) => `${withEulReul(p.item)} 샀어요. 이제 언제든 바꿀 수 있어요.`,
  close: '닫기',
  pickAria: (p: { item: string; n: number }) => `${p.item} ${p.n}번`,
  none: '없음',
  itemSkin: '피부색',
  itemHair: '머리색',
  itemBeard: '수염',
  itemStyle: '머리 모양',
  itemBand: '헤어밴드',
  itemBoots: '축구화',
  itemGlasses: '고글',
  styleShort: '짧은 머리',
  styleFringe: '앞머리',
  styleLong: '긴 머리',
  styleMohawk: '모히칸',
  styleSlick: '올백',
  styleBuzz: '까까머리',
  beardStubble: '짧은 수염',
  beardFull: '덥수룩한 수염',
  itemExpr: '표정',
  itemWrist: '손목 밴드',
  itemSocks: '양말',
  exprBase: '기본',
  exprHappy: '웃음',
  exprWink: '윙크',
  styleAfro: '아프로',
  styleBun: '묶은 머리',
  styleSpiky: '삐죽 머리',
  styleBald: '완전 민머리',
  styleShaved: '삭발',
  styleDread: '드레드',
  styleFauxhawk: '스파이크 모히칸',
  stylePonytail: '포니테일',
  styleMullet: '투톤 꽁지머리',
  itemGloves: '키퍼 장갑',
  itemKeeperKit: '키퍼 유니폼',
  itemKneePads: '무릎 보호대',
  kitClub: '구단 유니폼',
  socksTeam: '구단 양말',
};

export type AvatarLookMsgs = typeof ko;
export const avatarLookText = ns('avatarLook', ko);
