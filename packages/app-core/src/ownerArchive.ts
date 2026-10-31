import { fetchOwnerArchive, type OwnerArchiveResponse } from './api/ownerProfile.js';
import { fetchSeasonRecap, type SeasonRecapResponse } from './api/seasonRecap.js';
import { invalidateApiCache } from './api/client.js';
import { markRecapSeen } from './seasonRecap.js';

export type ArchiveState = {
  data: OwnerArchiveResponse | null;
  loading: boolean;
  error: boolean;
  season: number | null;
  expanded: boolean;
  detail: SeasonRecapResponse | null;
  detailLoading: boolean;
  detailError: boolean;
};

/** Load the selected closed season automatically; reuse its records while browsing seasons. */
export class OwnerArchive {
  state: ArchiveState = {
    data: null,
    loading: true,
    error: false,
    season: null,
    expanded: false,
    detail: null,
    detailLoading: false,
    detailError: false,
  };
  private epoch = 0;
  private pending = new Map<number, ReturnType<typeof fetchSeasonRecap>>();
  private records = new Map<number, SeasonRecapResponse>();
  private listeners = new Set<(s: ArchiveState) => void>();
  subscribe(fn: (s: ArchiveState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private update(patch: Partial<ArchiveState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }
  dispose() {
    this.epoch++;
    this.listeners.clear();
  }
  async load(preferred: number | null = null) {
    const epoch = ++this.epoch;
    this.update({ loading: true, error: false });
    const r = await fetchOwnerArchive();
    if (epoch !== this.epoch) return;
    if (!r.ok) return this.update({ loading: false, error: true });
    const seasons = r.data.owner.seasons;
    const season = seasons.some((s) => s.season === preferred)
      ? preferred
      : (seasons.at(-1)?.season ?? null);
    this.update({ data: r.data, loading: false, season });
    await this.expand();
  }
  async select(season: number) {
    if (season === this.state.season) return;
    this.epoch++;
    this.update({
      season,
      expanded: false,
      detail: this.records.get(season) ?? null,
      detailLoading: false,
      detailError: false,
    });
    await this.expand();
  }
  async expand(retry = false) {
    const season = this.state.season;
    if (season === null) return;
    const line = this.state.data?.owner.seasons.find((s) => s.season === season);
    if (!line?.closed) return;
    if (this.state.detailLoading) return;
    const found = this.records.get(season);
    if (found && !retry) {
      markRecapSeen(season);
      return this.update({ expanded: true, detail: found, detailError: false });
    }
    if (retry) invalidateApiCache('/v1/owner/season-recap');
    const epoch = ++this.epoch;
    this.update({ expanded: true, detailLoading: true, detailError: false, detail: null });
    const request = this.pending.get(season) ?? fetchSeasonRecap(season);
    this.pending.set(season, request);
    const r = await request;
    if (this.pending.get(season) === request) this.pending.delete(season);
    if (r.ok && r.data.status === 'ready') this.records.set(season, r.data);
    if (epoch !== this.epoch) return;
    if (!r.ok) return this.update({ detailLoading: false, detailError: true });
    if (r.data.status === 'ready') {
      markRecapSeen(season);
    }
    this.update({ detail: r.data, detailLoading: false });
  }
}
