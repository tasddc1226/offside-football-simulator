// 홈 선물 칸 · 시즌 업적 보상 · T-11-487 시즌 기록 보상(웹 HomeGift.svelte, 앱 screens/home/HomeGift.tsx). T-11-472 구단주 선물 문구는 없앴다. 지연 청크에서만 불러 첫 화면 번들에 넣지 않는다.
import { ns } from '../core';

type Got = { boost: number; scout: number; reroll?: number };
type Season = Got & { season: number };
/** 0장인 아이템은 빼고, 마지막 둘은 '과', 그 앞은 쉼표로 잇는다. */
const itemsOf = (p: Got) => {
  const xs = [
    p.reroll ? `리롤권 ${p.reroll}장` : '',
    p.boost ? `잠재력 강화권 ${p.boost}장` : '',
    p.scout ? `프리미엄 스카우트권 ${p.scout}장` : '',
  ].filter(Boolean);
  return xs.length > 2 ? `${xs.slice(0, -1).join(', ')}과 ${xs.at(-1)}` : xs.join('과 ');
};

const ko = {
  btn: '받기',
  busy: '받는 중…',
  fail: '선물을 받지 못했어요. 잠시 뒤 다시 눌러 주세요.',
  // T-11-386 시즌 업적 보상(같은 칸). 둘 중 0장인 아이템은 문장에서 뺀다.
  seasonTitle: (p: Season) => `시즌 ${p.season} 업적 보상이 도착했어요`,
  seasonSub: (p: Season) => `시즌 ${p.season} 업적으로 ${itemsOf(p)}을 받을 수 있어요.`,
  seasonDone: (p: Season) => `${itemsOf(p)}을 받았어요.`,
  // T-11-487 시즌 기록 보상(같은 칸, 업적 보상 다음). 내역 줄은 받는 갈래만 '·'로 잇는다.
  recordTitle: (p: Season) => `시즌 ${p.season} 기록 보상이 도착했어요`,
  recordSub: (p: Season) => `시즌 ${p.season} 명예의 전당 기록으로 ${itemsOf(p)}을 받을 수 있어요.`,
  recordHof: (p: { rank: number }) => `명예의 전당 ${p.rank}위`,
  recordIcons: (p: { n: number }) => `아이콘 ${p.n}명`,
  recordLegends: (p: { n: number }) => `레전드 ${p.n}명`,
  recordBallon: (p: { n: number }) => `발롱도르 수상 선수 ${p.n}명`,
  // T-11-517 광고 제거 구매 감사 선물(같은 칸, 기록 보상 다음).
  adFreeTitle: '광고 제거를 먼저 사 주셔서 고마워요',
  adFreeSub: (p: Got) => `감사 선물로 ${itemsOf(p)}을 받을 수 있어요.`,
  // T-11-440 받은 뒤 결과 · 쓰는 곳 안내
  doneTitle: '선물을 받았어요',
  useHint:
    '리롤권은 선수 만들기 후보 다시 뽑기에서, 강화권은 선수 탭 잠재력 강화에서, 스카우트권은 선수 만들기 후보 단계에서 써요.',
  toOwner: '내 구단에서 보기',
};

export type GiftMsgs = typeof ko;
export const giftText = ns('gift', ko);
