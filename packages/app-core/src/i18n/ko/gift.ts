// T-11-275 홈 선물(웹 HomeGift.svelte, 앱 screens/home/HomeGift.tsx). 지연 청크에서만 불러 첫 화면 번들에 넣지 않는다.
import { ns } from '../core';

const ko = {
  title: '구단주 선물이 도착했어요',
  sub: (p: { boost: number; scout: number }) =>
    `잠재력 강화권 ${p.boost}장과 프리미엄 스카우트권 ${p.scout}장을 받을 수 있어요.`,
  btn: '받기',
  busy: '받는 중…',
  done: (p: { boost: number; scout: number }) =>
    `잠재력 강화권 ${p.boost}장과 프리미엄 스카우트권 ${p.scout}장을 받았어요.`,
  fail: '선물을 받지 못했어요. 잠시 뒤 다시 눌러 주세요.',
};

export type GiftMsgs = typeof ko;
export const giftText = ns('gift', ko);
