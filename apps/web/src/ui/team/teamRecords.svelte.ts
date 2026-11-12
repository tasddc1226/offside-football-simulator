import {
  fetchClubAchievements,
  fetchTeamMatches,
  fetchTeamStats,
  type ClubAchievementsResponse,
  type TeamMatch,
  type TeamStatsResponse,
} from '@offside/app-core/api/team';
import type { AchCategory } from '@offside/contracts/owner-team';
import type { LoadStatus } from '../loadStatus.js';
import { achNudge } from '../achNudge.js';

/** Lazy records data only. Team retains the tab-entry and refresh triggers. */
export function createTeamRecords(season: () => number) {
  const state = $state({
    history: [] as TeamMatch[],
    histStatus: 'loading' as LoadStatus,
    histNext: null as string | null,
    moreStatus: 'idle' as 'idle' | 'loading' | 'error',
    stats: null as TeamStatsResponse | null,
    statsStatus: 'loading' as LoadStatus,
    statsFocus: null as string | null,
    ach: null as ClubAchievementsResponse | null,
    achStatus: 'loading' as LoadStatus,
    achCat: 'player' as AchCategory,
    achNewIds: new Set<string>() as ReadonlySet<string>,
  });
  async function loadAchievements(want = season()) {
    state.achStatus = 'loading';
    const r = await fetchClubAchievements(want);
    if (!r.ok) {
      state.achStatus = 'error';
      return;
    }
    state.ach = r.data;
    // T-11-034 가장 최근 시즌을 열면 본 것으로 적고, 지난번 뒤로 새로 오른 업적에 NEW를 붙여 그 분류·단계를 펼친다.
    const latest = Math.max(r.data.season, ...r.data.seasons.map((o) => o.id));
    state.achNewIds = r.data.season === latest ? achNudge.viewed(r.data) : new Set();
    const first = r.data.groups.find((g) => g.items.some((i) => state.achNewIds.has(i.id)));
    if (first) state.achCat = first.category;
    state.achStatus = 'ready';
  }

  async function loadHistory() {
    state.histStatus = 'loading';
    const r = await fetchTeamMatches(season());
    if (!r.ok) {
      state.histStatus = 'error';
      return;
    }
    state.history = r.data.items;
    state.histNext = r.data.next ?? null;
    state.moreStatus = 'idle';
    state.histStatus = 'ready';
  }
  async function loadMore() {
    if (!state.histNext || state.moreStatus === 'loading') return;
    state.moreStatus = 'loading';
    const cursor = state.histNext;
    const r = await fetchTeamMatches(season(), cursor);
    if (state.histNext !== cursor) return;
    if (!r.ok) {
      state.moreStatus = 'error';
      return;
    }
    const seen = new Set(state.history.map((m) => m.id));
    state.history = [...state.history, ...r.data.items.filter((m) => !seen.has(m.id))];
    state.histNext = r.data.next ?? null;
    state.moreStatus = 'idle';
  }
  async function loadStats() {
    state.statsStatus = 'loading';
    const r = await fetchTeamStats(season());
    if (!r.ok) {
      state.statsStatus = 'error';
      return;
    }
    state.stats = r.data;
    state.statsStatus = 'ready';
  }
  return { state, loadAchievements, loadHistory, loadMore, loadStats };
}
