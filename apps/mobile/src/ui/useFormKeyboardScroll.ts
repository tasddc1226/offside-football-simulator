import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type ScrollView } from 'react-native';
import { registerScroll, revealFocusedInput } from './scroll';

/** iOS의 자동 키보드 inset에 대응하는 Android 폼 스크롤 여백. 고정 하단 바는 옮기지 않는다. */
export function useFormKeyboardScroll() {
  const scroll = useRef<ScrollView | null>(null);
  const mounted = useRef(false);
  const frame = useRef<number | null>(null);
  const [bottomInset, setBottomInset] = useState(0);
  const ref = useCallback((v: ScrollView | null) => {
    scroll.current = v;
    registerScroll(v);
  }, []);
  const onLayout = useCallback(() => {
    if (!mounted.current) return;
    const keyboard = Keyboard.metrics();
    if (!keyboard) return;
    if (Platform.OS === 'ios') {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(revealFocusedInput);
      return;
    }
    if (Platform.OS !== 'android') return;
    const current = scroll.current;
    current?.getNativeScrollRef()?.measureInWindow((_x, top, _w, height) => {
      const visible = Keyboard.metrics();
      if (!mounted.current || scroll.current !== current || !visible) return;
      setBottomInset(Math.max(0, top + height - visible.screenY));
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(revealFocusedInput);
    });
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    mounted.current = true;
    onLayout();
    const show = Keyboard.addListener('keyboardDidShow', onLayout);
    const hide = Keyboard.addListener('keyboardDidHide', () => setBottomInset(0));
    return () => {
      mounted.current = false;
      show.remove();
      hide.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [onLayout]);
  return { ref, bottomInset, onLayout };
}
