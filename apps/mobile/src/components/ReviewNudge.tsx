import { useEffect, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { useSnapshot } from 'valtio';
import { appState, newsState, rnAlert, sheetState, storeUpdate, toastState } from '../store';
import { pushState } from '../platform/push';
import { reviewPrompt } from '../platform/review';
import { useTopBanner } from '../banners/useTopBanner';

/** 첫 커리어 종료부터, 은퇴 결과 화면이 안정된 뒤 OS 기본 리뷰 창을 요청한다. */
export function ReviewNudge() {
  const s = useSnapshot(appState);
  const sheet = useSnapshot(sheetState);
  const rn = useSnapshot(rnAlert);
  const toast = useSnapshot(toastState);
  const push = useSnapshot(pushState);
  const banner = useTopBanner();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const [focused, setFocused] = useState(true);
  const careerId = s.screen === 'retired' && s.G?.retired ? s.G.cid : null;
  useEffect(() => {
    const subs = [
      AppState.addEventListener('change', (state) => setActive(state === 'active')),
      Keyboard.addListener('keyboardDidShow', () => setKeyboard(true)),
      Keyboard.addListener('keyboardDidHide', () => setKeyboard(false)),
    ];
    if (Platform.OS === 'ios')
      subs.push(Keyboard.addListener('keyboardWillShow', () => setKeyboard(true)));
    if (Platform.OS === 'android')
      subs.push(
        AppState.addEventListener('blur', () => setFocused(false)),
        AppState.addEventListener('focus', () => setFocused(true)),
      );
    return () => subs.forEach((sub) => sub.remove());
  }, []);
  const safe =
    active &&
    focused &&
    !keyboard &&
    !sheet.open &&
    !rn.item &&
    !toast.visible &&
    !push.busy &&
    !banner;
  useEffect(() => {
    if (!careerId || !safe) return;
    let alive = true;
    const timer = setTimeout(() => {
      void reviewPrompt.afterCareer(
        careerId,
        () =>
          alive &&
          AppState.currentState === 'active' &&
          !Keyboard.isVisible() &&
          appState.screen === 'retired' &&
          appState.G?.cid === careerId &&
          appState.G.retired &&
          !sheetState.open &&
          !rnAlert.item &&
          !toastState.visible &&
          !newsState.post &&
          !(storeUpdate.url && !storeUpdate.closed) &&
          !pushState.busy,
      );
    }, 2000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [careerId, safe]);
  return null;
}
