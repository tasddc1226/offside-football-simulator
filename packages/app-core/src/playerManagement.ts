import type { TeamPlayer, OwnerTeamResponse } from './api/team.js';
import { invalidateApiCache } from './api/client.js';
import { fetchOwnerTeam } from './api/team.js';
import { fetchMarketMe, releaseCards } from './api/market.js';
import { lineupOf, releaseLock, releaseAmount, releaseRowInfo, MARKET_TOAST } from './market.js';
import { ownerPlayersText as L } from './i18n/ko/ownerPlayers.js';
import { cardEnhanceText as CE } from './i18n/ko/cardEnhance.js';
import { RELEASE_MAX } from '@offside/contracts/market-value';
import type { CareerPos } from '@offside/contracts';
import { DEFAULT_NATION } from '@offside/contracts/nations';

/** T-11-841 보유 선수 정렬: 최고 OVR · 레전드 점수 · 카드 기준가(방출 자금) · 강화 단계. */
export type ManageSort = 'peak' | 'score' | 'value' | 'enhance';
export const MANAGE_SORTS: readonly ManageSort[] = ['peak', 'score', 'value', 'enhance'];
/** T-11-841 보유 선수 필터: 포지션군 · 국적(없으면 전체). */
export type ManageFilter = { pos?: CareerPos | undefined; nation?: string | undefined };

export const MANAGE_SORT_LABEL: Record<ManageSort, () => string> = {
  peak: () => L.sortPeak,
  score: () => L.sortScore,
  value: () => L.sortValue,
  enhance: () => L.sortEnhance,
};
/** 보유 선수 한 줄: 세부 포지션 · 최고 OVR · 레전드 점수, 강화한 카드면 강화 단계를 붙인다. */
export const manageRowInfo = (p: TeamPlayer) =>
  p.enhance ? `${releaseRowInfo(p)} · ${CE.openLv({ lv: p.enhance })}` : releaseRowInfo(p);

const nationOf = (p: Pick<TeamPlayer, 'nation'>) => p.nation ?? DEFAULT_NATION;
const sortKey: Record<ManageSort, (p: TeamPlayer) => number> = {
  peak: (p) => p.peak,
  score: (p) => p.legendScore ?? 0,
  value: (p) => p.cardValue ?? 0,
  enhance: (p) => p.enhance ?? 0,
};

/** 화면에 보일 보유 선수: 필터를 거쳐 고른 기준으로 높은 순. 같으면 최고 OVR · 레전드 점수 순으로 고정한다. */
export function manageView(
  players: readonly TeamPlayer[],
  filter: ManageFilter,
  sort: ManageSort,
): TeamPlayer[] {
  const key = sortKey[sort];
  return players
    .filter(
      (p) =>
        (!filter.pos || p.pos === filter.pos) && (!filter.nation || nationOf(p) === filter.nation),
    )
    .sort(
      (a, b) =>
        key(b) - key(a) ||
        b.peak - a.peak ||
        (b.legendScore ?? 0) - (a.legendScore ?? 0) ||
        a.careerId.localeCompare(b.careerId),
    );
}

/** 국적 필터 선택지: 보유 선수가 있는 나라만, 많은 순(같으면 코드 순). */
export function manageNations(players: readonly TeamPlayer[]): { code: string; n: number }[] {
  const count = new Map<string, number>();
  for (const p of players) count.set(nationOf(p), (count.get(nationOf(p)) ?? 0) + 1);
  return [...count]
    .map(([code, n]) => ({ code, n }))
    .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
}

export type PlayerManagementState = {
  season: number;
  players: TeamPlayer[];
  lineup: ReadonlySet<string>;
  rate: number;
  selected: ReadonlySet<string>;
  loading: boolean;
  busy: boolean;
  confirm: boolean;
  error: string | null;
  notice: string | null;
  filter: ManageFilter;
  sort: ManageSort;
};
export const managedPlayers = (team: OwnerTeamResponse) =>
  team.players.filter((p) => (p.season ?? team.season) === team.season);

/** On-demand owner-only reads; shared eligibility, capped selections and mutation recovery for both clients. */
export class PlayerManagement {
  state: PlayerManagementState = {
    season: 0,
    players: [],
    lineup: new Set(),
    rate: 0,
    selected: new Set(),
    loading: true,
    busy: false,
    confirm: false,
    error: null,
    notice: null,
    filter: {},
    sort: 'peak',
  };
  private epoch = 0;
  private listeners = new Set<(state: PlayerManagementState) => void>();
  subscribe(fn: (state: PlayerManagementState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private update(patch: Partial<PlayerManagementState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }
  dispose() {
    this.epoch++;
    this.listeners.clear();
  }
  get eligible() {
    return this.state.players.filter((p) => !releaseLock(p, this.state.lineup));
  }
  /** 필터 · 정렬을 거친 목록. 고른 선수는 필터 밖으로 나가도 선택이 유지된다. */
  get visible() {
    return manageView(this.state.players, this.state.filter, this.state.sort);
  }
  setFilter(patch: ManageFilter) {
    this.update({ filter: { ...this.state.filter, ...patch } });
  }
  setSort(sort: ManageSort) {
    this.update({ sort });
  }
  get selectedPlayers() {
    return this.eligible.filter((p) => this.state.selected.has(p.careerId));
  }
  get amount() {
    return releaseAmount(this.selectedPlayers, this.state.rate);
  }
  async load(season: number) {
    const epoch = ++this.epoch;
    this.update({
      season,
      loading: true,
      players: [],
      selected: new Set(),
      confirm: false,
      error: null,
      notice: null,
    });
    // Current lineup also protects wildcard players while browsing an older season.
    const [team, me, current] = await Promise.all([
      fetchOwnerTeam(season),
      fetchMarketMe(),
      fetchOwnerTeam(),
    ]);
    if (epoch !== this.epoch) return;
    if (!team.ok || !me.ok || !current.ok) {
      const error = !team.ok
        ? team.error.message
        : !me.ok
          ? me.error.message
          : !current.ok
            ? current.error.message
            : '';
      this.update({ loading: false, error });
      return;
    }
    this.update({
      loading: false,
      players: managedPlayers(team.data),
      lineup: lineupOf(current.data),
      rate: me.data.rules.releaseRate,
    });
  }
  toggle(id: string) {
    if (
      this.state.busy ||
      this.state.loading ||
      this.state.confirm ||
      !this.eligible.some((p) => p.careerId === id)
    )
      return;
    const selected = new Set(this.state.selected);
    if (selected.has(id)) selected.delete(id);
    else if (selected.size < RELEASE_MAX) selected.add(id);
    this.update({ selected, notice: null });
  }
  selectAll() {
    if (this.state.busy || this.state.loading || this.state.confirm) return;
    this.update({
      selected: this.state.selected.size
        ? new Set()
        : new Set(
            this.visible
              .filter((p) => !releaseLock(p, this.state.lineup))
              .slice(0, RELEASE_MAX)
              .map((p) => p.careerId),
          ),
      notice: null,
    });
  }
  confirm(value: boolean) {
    if (!this.state.busy && (!value || this.selectedPlayers.length))
      this.update({ confirm: value });
  }
  async release() {
    if (this.state.busy || !this.state.confirm || !this.selectedPlayers.length) return;
    const epoch = this.epoch;
    this.update({ busy: true, error: null });
    const result = await releaseCards(this.selectedPlayers.map((p) => p.careerId));
    if (epoch !== this.epoch) {
      this.update({ busy: false });
      return;
    }
    if (!result.ok) {
      invalidateApiCache('/v1/owner-team');
      invalidateApiCache('/v1/market/me');
    }
    // Re-read authoritative ownership/locks even after a conflict or partial release.
    const reload = this.load(this.state.season);
    const reloadEpoch = this.epoch;
    await reload;
    if (reloadEpoch !== this.epoch) {
      this.update({ busy: false });
      return;
    }
    this.update({
      busy: false,
      ...(result.ok
        ? { notice: MARKET_TOAST.released(result.data.released) }
        : { error: result.error.message }),
    });
  }
}
