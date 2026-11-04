// 하단 메뉴를 스크롤 방향에 따라 숨길지 정한다(순수 계산). 튕김처럼 끝을 넘은 값은 끝으로 잘라, 맨 아래에서 튕겨도 위로 올린 것으로 치지 않는다.

/** 맨 위에서 이만큼 안쪽이면 언제나 보인다. */
const TOP = 24;
/** 한 방향으로 이만큼 움직여야 바뀐다(손떨림에 깜빡이지 않게). */
const TRAVEL = 12;

export type BarScroll = { last: number; travel: number; hidden: boolean };
export const BAR_SCROLL_START: BarScroll = { last: 0, travel: 0, hidden: false };

export function nextBarScroll(s: BarScroll, y: number, maxY: number): BarScroll {
  const at = Math.min(Math.max(y, 0), Math.max(maxY, 0));
  if (at <= TOP) return { last: at, travel: 0, hidden: false };
  const moved = at - s.last;
  if (!moved) return s;
  const travel = moved > 0 === s.travel > 0 ? s.travel + moved : moved;
  const hidden = travel >= TRAVEL ? true : travel <= -TRAVEL ? false : s.hidden;
  return { last: at, travel, hidden };
}
