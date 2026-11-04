// 앱 하단 메뉴(TabBar)를 스크롤 방향에 따라 숨기고 올린다. 메뉴는 화면 위에 떠 있고, 화면은 메뉴 높이만큼 아래 여백을 둔다.
// JS는 방향이 바뀔 때만 목표를 정하고 움직임은 UI 스레드에서 돈다. 키보드 · 화면 읽기 · 첫 커리어 안내 중에는 숨기지 않는다.
import { createContext, useContext } from 'react';
import { AccessibilityInfo, Keyboard } from 'react-native';
import { Easing, makeMutable, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { proxy, useSnapshot } from 'valtio';
import { prefs } from '../store';
import { BAR_SCROLL_START, nextBarScroll } from './barScroll';
import { coachState } from '../components/Coachmark';

/** 화면 아래에 탭바가 붙어 있다(탭바가 아래 안전 영역을 채운다). 루트·게임 화면이 넣는다. */
export const BarBelow = createContext(false);

/** 0이면 보이고 1이면 숨었다. */
export const barHidden = makeMutable(0);
/** 안전 영역까지 포함한 메뉴 높이. 처음 잴 때까지는 어림값이다. */
const BAR_H_GUESS = 60;
export const barHeightUI = makeMutable(BAR_H_GUESS);
const bar = proxy({ h: BAR_H_GUESS });

let scroll = BAR_SCROLL_START;
let keyboard = false;
let reader = false;

const apply = (hidden: boolean) => {
  barHidden.value = withTiming(hidden ? 1 : 0, {
    duration: prefs.motionOK ? 220 : 0,
    easing: Easing.out(Easing.cubic),
  });
};

export function noteBarH(h: number) {
  if (h <= 0 || h === bar.h) return;
  bar.h = h;
  barHeightUI.value = h;
}

/** 화면이 차지하지 말아야 할 아래 높이. 메뉴가 없는 화면은 0이다. */
export function useBarInset() {
  const barBelow = useContext(BarBelow);
  const { h } = useSnapshot(bar);
  return barBelow ? h : 0;
}

/** 메뉴 위에 떠 있는 것(버튼 줄 · 채팅 버튼)이 메뉴를 따라 내려가 안전 영역 위에 멈추는 움직임. */
export function useBarFollow() {
  const { bottom } = useSafeAreaInsets();
  return useAnimatedStyle(() => ({
    transform: [{ translateY: barHidden.value * Math.max(0, barHeightUI.value - bottom) }],
  }));
}

/** 화면을 옮겼거나 맨 위로 돌아왔을 때 메뉴를 되돌린다. */
export function showBar() {
  scroll = BAR_SCROLL_START;
  apply(keyboard);
}

export function noteBarScroll(y: number, maxY: number) {
  if (keyboard || reader || coachState.i !== null) return;
  const next = nextBarScroll(scroll, y, maxY);
  const changed = next.hidden !== scroll.hidden;
  scroll = next;
  if (changed) apply(next.hidden);
}

/** 키보드가 뜨면 메뉴가 입력칸을 가리지 않게 내려 둔다. 메뉴가 그려질 때 붙이고 해제 함수를 돌려준다. */
export function watchBarLocks() {
  const subs = [
    Keyboard.addListener('keyboardDidShow', () => {
      keyboard = true;
      apply(true);
    }),
    Keyboard.addListener('keyboardDidHide', () => {
      keyboard = false;
      apply(scroll.hidden);
    }),
    AccessibilityInfo.addEventListener('screenReaderChanged', (on) => {
      reader = on;
      if (on) showBar();
    }),
  ];
  void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
    reader = on;
    if (on) showBar();
  });
  return () => subs.forEach((s) => s.remove());
}
