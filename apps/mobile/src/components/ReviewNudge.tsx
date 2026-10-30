import { useEffect, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { useSnapshot } from 'valtio';
import { appState, newsState, rnAlert, sheetState, storeUpdate, toastState } from '../store';
import { interstitial } from '../platform/interstitial';
import { pushState } from '../platform/push';
import { reviewPrompt } from '../platform/review';
import { reviewWorthyCareer } from '@offside/app-core/reviewPrompt';
import { ballonWinsOf, legendScore } from '@offside/game/legend';
import { useTopBanner } from '../banners/useTopBanner';

/** 좋은 커리어(클럽 레전드 이상 · 발롱도르)가 끝난 뒤, 은퇴 결과 화면이 안정되면 OS 기본 리뷰 창을 요청한다(T-11-586). */
export function ReviewNudge() {
  const s = useSnapshot(appState);
  const sheet = useSnapshot(sheetState);
  const rn = useSnapshot(rnAlert);
  const toast = useSnapshot(toastState);
  const push = useSnapshot(pushState);
  const ad = useSnapshot(interstitial);
  const banner = useTopBanner();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const [focused, setFocused] = useState(true);
  const retiredId = s.screen === 'retired' && s.G?.retired ? s.G.cid : null;
  // 점수 계산은 스냅숏(읽기 전용 타입)이 아니라 원본 상태로 한다.
  const G = appState.G;
  const careerId =
    retiredId && G?.cid === retiredId && reviewWorthyCareer(legendScore(G), G.dpos, ballonWinsOf(G))
      ? retiredId
      : null;
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
    !ad.showing &&
    !banner;
  useEffect(() => {
    if (!careerId || !safe) return;
    let alive = true;
    const timer = setTimeout(() => {
      void reviewPrompt.afterHighlight(
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
          !storeUpdate.showing &&
          !pushState.busy &&
          !interstitial.showing,
      );
    }, 2000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [careerId, safe]);
  return null;
}
