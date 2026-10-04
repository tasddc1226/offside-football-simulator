// T-11-034 업적 달성 알림 — 판단·기록은 app-core/achNudge. App.svelte가 표시(achDirty)가 있을 때만 이 모듈을 불러온다
// (업적·등급 계산을 첫 화면 번들 밖에 둔다). 내 팀 업적 탭은 viewed로 본 것을 적는다.
import { createAchNudge } from '@offside/app-core/achNudge';
import { fetchClubAchievements } from '@offside/app-core/api/team';
import { go } from './nav.js';
import { closeSheet, sheetState, showSheet } from './sheetState.svelte.js';
import { appState } from './state.svelte.js';

export const achNudge = createAchNudge({
  state: appState,
  fetch: () => fetchClubAchievements(),
  sheetOpen: () => sheetState.open,
  showSheet: (v, buttons) => void showSheet(v, buttons),
  closeSheet,
  openAchievements: () => {
    appState.teamView = 'achievements';
    go('team');
    window.scrollTo(0, 0);
  },
});
