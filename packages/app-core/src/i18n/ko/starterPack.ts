// T-11-770d 첫 구매 묶음(앱 상점 · 은퇴 화면 카드, platform/starterPack.ts).
import { ns } from '../core';

const ko = {
  title: '첫 구매 묶음',
  note: '한 계정에 한 번만 살 수 있어요. 결제는 스토어 계정으로 하고, 이 구단주 계정에 들어와요.',
  buy: (p: { price: string }) => `${p.price}에 사기`,
  bought: '첫 구매 묶음을 받았어요.',
  close: '닫기',
};

export type StarterPackMsgs = typeof ko;
export const starterPackText = ns('starterPack', ko);
