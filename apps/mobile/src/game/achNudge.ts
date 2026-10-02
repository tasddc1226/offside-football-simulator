// T-11-034 업적 달성 알림(웹 ui/achNudge.ts) — 판단·기록은 app-core/achNudge. 앱 루트가 표시(achDirty)가 있으면 check,
// 내 팀 업적 탭이 viewed로 본 것을 적는다.
import { createAchNudge } from '@offside/app-core/achNudge';
import { fetchClubAchievements } from '@offside/app-core/api/team';
import { appState, sheetState } from '../store';
import { scrollTo } from '../ui/scroll';
import { closeSheet, showSheet } from './host';
import { go } from './nav';

export const achNudge = createAchNudge({
  state: appState,
  fetch: () => fetchClubAchievements(),
  sheetOpen: () => sheetState.open,
  showSheet: (v, buttons) => void showSheet(v, buttons),
  closeSheet,
  openAchievements: () => {
    appState.teamView = 'achievements';
    go('team');
    scrollTo(0);
  },
});
