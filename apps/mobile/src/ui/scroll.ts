// T-11-005 지금 화면의 세로 스크롤. 웹은 창(window) 하나를 스크롤하지만 앱은 화면마다 ScrollView가 있다 — Screen이
// 자기 ScrollView를 여기 등록하고, 진행 액션(맨 위로)·뒤로 가기(떠난 자리로)가 이걸로 옮긴다.
import type { ScrollView } from 'react-native';

let view: ScrollView | null = null;
let y = 0;

export function registerScroll(v: ScrollView | null) {
  view = v;
  if (v) y = 0;
}
export const noteScrollY = (next: number) => void (y = next);
export const scrollY = () => y;
export function scrollTo(next: number, animated = false) {
  view?.scrollTo({ y: next, animated });
}
