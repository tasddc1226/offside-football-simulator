// ───────── 화면 고르기 (웹 App.svelte) ─────────
// 웹처럼 주소가 아니라 appState.screen으로 화면을 그린다(expo-router는 딥링크 입구만 맡는다). 화면이 바뀔 때마다
// 방문 기록을 쌓아 Android 뒤로 버튼이 이전 화면으로 간다(마지막이면 앱을 닫는다).
import { useEffect, type ComponentType } from 'react';
import { BackHandler, View } from 'react-native';
import { subscribe, useSnapshot } from 'valtio';
import { achCheckable, isAchDirty, onAchDirty } from '@offside/app-core/achDirty';
import type { Screen } from '@offside/app-core/state';
import { trackPage } from '../analytics';
import { appState, sheetState } from '../store';
import { achNudge } from '../game/achNudge';
import { closeSheet, navStack } from '../game/host';
import { MainNav, hasMainNav } from '../ui/MainNav';
import { BarBelow } from '../ui/Screen';
import { Sheet } from '../ui/Sheet';
import { TABBAR_H } from '../ui/TabBar';
import { Toast } from '../ui/Toast';
import { NewsBanner } from '../banners/NewsBanner';
import { UpdateBanner } from '../banners/UpdateBanner';
import { StoreUpdateBanner } from '../banners/StoreUpdateBanner';
import { RetiredNumberAlert } from '../banners/RetiredNumberAlert';
import { useColors } from '../theme/useColors';
import Home from '../screens/home/Home';
import Create from '../screens/create/Create';
import Game from '../screens/game/Game';
import Retired from '../screens/retired/Retired';
import Legend from '../screens/retired/Legend';
import Shared from '../screens/retired/Shared';
import Hof from '../screens/hof/Hof';
import Firsts from '../screens/hof/Firsts';
import Dex from '../screens/hof/Dex';
import Board from '../screens/board/Board';
import Chat from '../screens/chat/Chat';
import Owner from '../screens/owner/Owner';
import Team from '../screens/owner/Team';
import Settings from '../screens/settings/Settings';
import Admin from '../screens/settings/Admin';
import { ReviewNudge } from '../components/ReviewNudge';

const SCREENS: Record<Screen, ComponentType> = {
  home: Home,
  create: Create,
  game: Game,
  retired: Retired,
  legend: Legend,
  shared: Shared,
  hof: Hof,
  firsts: Firsts,
  dex: Dex,
  board: Board,
  chat: Chat,
  owner: Owner,
  team: Team,
  settings: Settings,
  admin: Admin,
};

const checkAch = () => {
  if (achCheckable(appState.screen, appState.teamView, sheetState.open) && isAchDirty())
    void achNudge.check();
};

export default function App() {
  const snap = useSnapshot(appState);
  const c = useColors();
  useEffect(() => trackPage(snap.screen), [snap.screen]);
  // 상태가 바뀔 때마다(묶어서) 기록 단위가 바뀌었는지 본다 — 같으면 track()이 아무것도 안 한다.
  useEffect(() => subscribe(appState, () => navStack.track()), []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetState.open) {
        // 선택이 필수인 시트는 Sheet의 onRequestClose가 막는다 — 여기 오는 건 닫을 수 있는 시트다.
        closeSheet();
        return true;
      }
      return navStack.back();
    });
    return () => sub.remove();
  }, []);

  // T-11-034 업적 달성 알림(웹 App.svelte) — 업적이 바뀌었을 수 있는 쓰기 뒤 홈·기록실·구단주·내 팀에 오면 한 번 업적을
  // 받아 새 업적을 시트로 알린다(경기 결과를 보는 중이거나 다른 시트가 떠 있으면 닫힌 뒤). 은퇴 업로드가 끝나면 화면을
  // 옮기지 않아도 다시 본다. 보지 않은 새 업적 수(하단 점)는 앱을 열 때 되살린다. 시트는 구독으로 봐서 루트가 시트마다
  // 다시 그려지지 않게 한다.
  useEffect(() => {
    achNudge.restore();
    const offs = [onAchDirty(checkAch), subscribe(sheetState, checkAch)];
    return () => offs.forEach((off) => off());
  }, []);
  useEffect(checkAch, [snap.screen, snap.teamView]);

  const Current = SCREENS[snap.screen];
  const main = hasMainNav(snap.screen);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarBelow.Provider value={main}>
        {/* 게시판은 게시판을 바꿀 때 새로 그린다(웹 {#key appState.board}). */}
        <Current key={snap.screen === 'board' ? `board:${snap.board}` : snap.screen} />
      </BarBelow.Provider>
      {main ? <MainNav /> : null}
      <StoreUpdateBanner />
      <UpdateBanner />
      <NewsBanner />
      <RetiredNumberAlert />
      <ReviewNudge />
      <Sheet />
      {/* 아래 탭 막대(메인·게임)가 있으면 그 위로 띄운다(웹 body:has(nav.tabs) .toast). */}
      <Toast lift={main || snap.screen === 'game' ? TABBAR_H : 0} />
    </View>
  );
}
