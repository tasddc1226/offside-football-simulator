import type { TeamPlayer, OwnerTeamResponse } from './api/team.js';
import { invalidateApiCache } from './api/client.js';
import { fetchOwnerTeam } from './api/team.js';
import { fetchMarketMe, releaseCards } from './api/market.js';
import { lineupOf, releaseLock, releaseAmount, MARKET_TOAST } from './market.js';
import { RELEASE_MAX } from '@offside/contracts/market-value';

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
        : new Set(this.eligible.slice(0, RELEASE_MAX).map((p) => p.careerId)),
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
