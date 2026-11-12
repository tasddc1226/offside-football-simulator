import { useState } from 'react';
import {
  fetchClubAchievements,
  fetchTeamMatches,
  fetchTeamStats,
  type ClubAchievementsResponse,
  type TeamMatch,
  type TeamStatsResponse,
} from '@offside/app-core/api/team';
import type { LoadStatus } from '../../components/LoadState';
import { achNudge } from '../../game/achNudge';

/** Lazy records data only. The screen retains tab entry, push navigation and pull-to-refresh. */
export function useTeamRecords(season: number) {
  const [history, setHistory] = useState<TeamMatch[]>([]);
  const [histStatus, setHistStatus] = useState<LoadStatus>('loading');
  // T-11-269 경기 기록 다음 쪽 커서('더 보기'), 시즌 통계와 경기 결과에서 누른 선수.
  const [histNext, setHistNext] = useState<string | null>(null);
  const [moreStatus, setMoreStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);
  const [statsStatus, setStatsStatus] = useState<LoadStatus>('loading');
  const [statsFocus, setStatsFocus] = useState<string | null>(null);
  const [ach, setAch] = useState<ClubAchievementsResponse | null>(null);
  const [achStatus, setAchStatus] = useState<LoadStatus>('loading');
  /** T-11-034 지난번 업적 탭을 본 뒤 새로 오른 업적(NEW). */
  const [achNewIds, setAchNewIds] = useState<ReadonlySet<string>>(new Set());
  async function loadAchievements(want = season, silent = false) {
    if (!silent) setAchStatus('loading');
    const r = await fetchClubAchievements(want);
    if (!r.ok) return silent ? undefined : setAchStatus('error');
    setAch(r.data);
    // T-11-034 가장 최근 시즌을 열면 본 것으로 적고, 지난번 뒤로 새로 오른 업적에 NEW를 붙인다(웹 Team.svelte).
    const latest = Math.max(r.data.season, ...r.data.seasons.map((o) => o.id));
    setAchNewIds(r.data.season === latest ? achNudge.viewed(r.data) : new Set());
    setAchStatus('ready');
  }

  async function loadHistory(silent = false) {
    if (!silent) setHistStatus('loading');
    const r = await fetchTeamMatches(season);
    if (!r.ok) return silent ? undefined : setHistStatus('error');
    setHistory(r.data.items);
    setHistNext(r.data.next ?? null);
    setMoreStatus('idle');
    setHistStatus('ready');
  }
  async function loadMore() {
    if (!histNext || moreStatus === 'loading') return;
    setMoreStatus('loading');
    const r = await fetchTeamMatches(season, histNext);
    if (!r.ok) return setMoreStatus('error');
    setHistory((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...r.data.items.filter((m) => !seen.has(m.id))];
    });
    setHistNext(r.data.next ?? null);
    setMoreStatus('idle');
  }
  async function loadStats(silent = false) {
    if (!silent) setStatsStatus('loading');
    const r = await fetchTeamStats(season);
    if (!r.ok) return silent ? undefined : setStatsStatus('error');
    setStats(r.data);
    setStatsStatus('ready');
  }
  return {
    history,
    histStatus,
    histNext,
    moreStatus,
    stats,
    statsStatus,
    statsFocus,
    ach,
    achStatus,
    achNewIds,
    setStatsFocus,
    loadAchievements,
    loadHistory,
    loadMore,
    loadStats,
  };
}
