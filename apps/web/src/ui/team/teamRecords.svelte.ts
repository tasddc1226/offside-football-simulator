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
  let history = $state<TeamMatch[]>([]);
  let histStatus = $state<LoadStatus>('loading');
  /** T-11-269 경기 기록 다음 쪽 커서('더 보기'), 시즌 통계와 경기 결과에서 누른 선수. */
  let histNext = $state<string | null>(null);
  let moreStatus = $state<'idle' | 'loading' | 'error'>('idle');
  let stats = $state<TeamStatsResponse | null>(null);
  let statsStatus = $state<LoadStatus>('loading');
  let statsFocus = $state<string | null>(null);
  let ach = $state<ClubAchievementsResponse | null>(null);
  let achStatus = $state<LoadStatus>('loading');
  /** T-11-028 업적 화면에서 보고 있는 분류(선수·팀·구단주·감독). */
  let achCat = $state<AchCategory>('player');
  /** T-11-034 지난번 업적 탭을 본 뒤 새로 오른 업적(NEW). */
  let achNewIds = $state<ReadonlySet<string>>(new Set());

  async function loadAchievements(want = season()) {
    achStatus = 'loading';
    const r = await fetchClubAchievements(want);
    if (!r.ok) {
      achStatus = 'error';
      return;
    }
    ach = r.data;
    // T-11-034 가장 최근 시즌을 열면 본 것으로 적고, 지난번 뒤로 새로 오른 업적에 NEW를 붙여 그 분류·단계를 펼친다.
    const latest = Math.max(r.data.season, ...r.data.seasons.map((o) => o.id));
    achNewIds = r.data.season === latest ? achNudge.viewed(r.data) : new Set();
    const first = r.data.groups.find((g) => g.items.some((i) => achNewIds.has(i.id)));
    if (first) achCat = first.category;
    achStatus = 'ready';
  }

  async function loadHistory() {
    histStatus = 'loading';
    const r = await fetchTeamMatches(season());
    if (!r.ok) {
      histStatus = 'error';
      return;
    }
    history = r.data.items;
    histNext = r.data.next ?? null;
    moreStatus = 'idle';
    histStatus = 'ready';
  }
  async function loadMore() {
    if (!histNext || moreStatus === 'loading') return;
    moreStatus = 'loading';
    const cursor = histNext;
    const r = await fetchTeamMatches(season(), cursor);
    if (histNext !== cursor) return;
    if (!r.ok) {
      moreStatus = 'error';
      return;
    }
    const seen = new Set(history.map((m) => m.id));
    history = [...history, ...r.data.items.filter((m) => !seen.has(m.id))];
    histNext = r.data.next ?? null;
    moreStatus = 'idle';
  }
  async function loadStats() {
    statsStatus = 'loading';
    const r = await fetchTeamStats(season());
    if (!r.ok) {
      statsStatus = 'error';
      return;
    }
    stats = r.data;
    statsStatus = 'ready';
  }
  return {
    get history() {
      return history;
    },
    get histStatus() {
      return histStatus;
    },
    get histNext() {
      return histNext;
    },
    get moreStatus() {
      return moreStatus;
    },
    get stats() {
      return stats;
    },
    get statsStatus() {
      return statsStatus;
    },
    get statsFocus() {
      return statsFocus;
    },
    set statsFocus(value: typeof statsFocus) {
      statsFocus = value;
    },
    get ach() {
      return ach;
    },
    get achStatus() {
      return achStatus;
    },
    get achCat() {
      return achCat;
    },
    set achCat(value: typeof achCat) {
      achCat = value;
    },
    get achNewIds() {
      return achNewIds;
    },
    loadAchievements,
    loadHistory,
    loadMore,
    loadStats,
  };
}
