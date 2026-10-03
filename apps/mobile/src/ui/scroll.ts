// T-11-005 지금 화면의 세로 스크롤. 웹은 창(window) 하나를 스크롤하지만 앱은 화면마다 ScrollView가 있다 — Screen이
// 자기 ScrollView를 여기 등록하고, 진행 액션(맨 위로)·뒤로 가기(떠난 자리로)가 이걸로 옮긴다.
import { Keyboard, TextInput, type ScrollView } from 'react-native';

let view: ScrollView | null = null;
let y = 0;
let h = 0;

export function registerScroll(v: ScrollView | null) {
  view = v;
  if (v) y = 0;
}
export const noteScrollY = (next: number) => void (y = next);
export const scrollY = () => y;
/** 스크롤 창 높이(탭바·하단 바를 뺀 보이는 높이). */
export const noteViewH = (next: number) => void (h = next);
export const viewH = () => h;
export function scrollTo(next: number, animated = false) {
  view?.scrollTo({ y: next, animated });
}

/** 키보드에 가려진 입력칸만 드러낸다. 여러 줄 입력은 iOS 자동 inset만으로 부족할 수 있다. */
export function revealFocusedInput() {
  const scroll = view;
  const input = TextInput.State.currentlyFocusedInput();
  const viewport = scroll?.getNativeScrollRef();
  const keyboard = Keyboard.metrics();
  if (!scroll || !input || !viewport || !keyboard) return;
  // 다른 Modal의 검색칸이면 이 스크롤의 자식이 아니므로 움직이지 않는다.
  input.measureLayout(
    viewport,
    (_x, top, _w, height) => {
      scroll.getNativeScrollRef()?.measureInWindow((_sx, sy, _sw, sh) => {
        if (view !== scroll || TextInput.State.currentlyFocusedInput() !== input) return;
        const visible = Keyboard.metrics();
        if (!visible) return;
        const bottom = Math.min(sy + sh, visible.screenY) - 12;
        const hidden = sy + top - y + height - bottom;
        if (hidden > 0) scroll.scrollTo({ y: y + hidden, animated: false });
      });
    },
    () => {},
  );
}
