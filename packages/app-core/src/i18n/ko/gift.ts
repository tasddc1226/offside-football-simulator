// T-11-275 홈 선물(웹 HomeGift.svelte, 앱 screens/home/HomeGift.tsx). 지연 청크에서만 불러 첫 화면 번들에 넣지 않는다.
import { ns } from '../core';

type Got = { boost: number; scout: number };
type Season = Got & { season: number };
const itemsOf = (p: Got) =>
  [p.boost ? `잠재력 강화권 ${p.boost}장` : '', p.scout ? `프리미엄 스카우트권 ${p.scout}장` : '']
    .filter(Boolean)
    .join('과 ');

const ko = {
  title: '구단주 선물이 도착했어요',
  sub: (p: { boost: number; scout: number }) =>
    `잠재력 강화권 ${p.boost}장과 프리미엄 스카우트권 ${p.scout}장을 받을 수 있어요.`,
  btn: '받기',
  busy: '받는 중…',
  done: (p: { boost: number; scout: number }) =>
    `잠재력 강화권 ${p.boost}장과 프리미엄 스카우트권 ${p.scout}장을 받았어요.`,
  fail: '선물을 받지 못했어요. 잠시 뒤 다시 눌러 주세요.',
  // T-11-386 시즌 업적 보상(같은 칸). 둘 중 0장인 아이템은 문장에서 뺀다.
  seasonTitle: (p: Season) => `시즌 ${p.season} 업적 보상이 도착했어요`,
  seasonSub: (p: Season) => `시즌 ${p.season} 업적으로 ${itemsOf(p)}을 받을 수 있어요.`,
  seasonDone: (p: Season) => `${itemsOf(p)}을 받았어요.`,
  // T-11-440 받은 뒤 결과 · 쓰는 곳 안내
  doneTitle: '선물을 받았어요',
  useHint: '강화권은 선수 탭 잠재력 강화에서, 스카우트권은 선수 만들기 후보 단계에서 써요.',
  toOwner: '내 구단에서 보기',
};

export type GiftMsgs = typeof ko;
export const giftText = ns('gift', ko);
