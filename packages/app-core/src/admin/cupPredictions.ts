import * as api from '../api/admin.js';
import type { AdminCup, AdminCupPredictions, AdminCupPredictionRows } from '../api/admin.js';

export interface CupAdminState {
  cups: AdminCup[];
  season: number;
  cupId: string;
  report: AdminCupPredictions | null;
  matchId: string;
  rows: AdminCupPredictionRows | null;
  loading: boolean;
  detailLoading: boolean;
  busy: boolean;
  error: string;
}
export const emptyCupAdmin = (): CupAdminState => ({
  cups: [],
  season: 0,
  cupId: '',
  report: null,
  matchId: '',
  rows: null,
  loading: true,
  detailLoading: false,
  busy: false,
  error: '',
});
/** Explicit reads only. Generation guards keep late requests from crossing cup/match selections. */
export function createCupAdmin(changed: (s: CupAdminState) => void) {
  let state = emptyCupAdmin();
  let generation = 0;
  let detailGeneration = 0;
  const patch = (v: Partial<CupAdminState>) => {
    state = { ...state, ...v };
    changed(state);
  };
  async function select(cupId: string, fresh = false) {
    const g = ++generation;
    ++detailGeneration;
    patch({
      cupId,
      report: null,
      matchId: '',
      rows: null,
      loading: true,
      detailLoading: false,
      error: '',
    });
    if (!cupId) {
      patch({ loading: false });
      return;
    }
    const r = await api.fetchAdminCupPredictions(cupId, fresh);
    if (g !== generation) return;
    patch(r.ok ? { report: r.data, loading: false } : { error: r.error.message, loading: false });
  }
  async function load(catalog?: AdminCup[]) {
    const g = ++generation;
    patch({ loading: true, error: '' });
    const r = catalog
      ? { ok: true as const, data: { items: catalog } }
      : await api.fetchAdminCups();
    if (g !== generation) return;
    if (!r.ok) {
      patch({ loading: false, error: r.error.message });
      return;
    }
    const first = r.data.items[0];
    patch({ cups: r.data.items, season: first?.cup.season ?? 0 });
    await select(first?.cup.id ?? '');
  }
  async function season(season: number) {
    patch({ season });
    await select(state.cups.find((c) => c.cup.season === season)?.cup.id ?? '');
  }
  async function details(matchId: string, more = false) {
    const g = ++detailGeneration;
    const cupId = state.cupId;
    const previous = more ? state.rows : null;
    patch({ matchId, rows: previous, detailLoading: true, error: '' });
    const r = await api.fetchAdminCupPredictionRows(cupId, matchId, previous?.next ?? '');
    if (g !== detailGeneration || cupId !== state.cupId) return;
    patch(
      r.ok
        ? {
            rows: { ...r.data, items: [...(previous?.items ?? []), ...r.data.items] },
            detailLoading: false,
          }
        : { detailLoading: false, error: r.error.message },
    );
  }
  async function recover(reason: string) {
    if (state.busy || !state.matchId) return false;
    const cupId = state.cupId,
      matchId = state.matchId;
    patch({ busy: true, error: '' });
    const r = await api.recoverCupPredictions(cupId, matchId, reason);
    patch({ busy: false });
    if (!r.ok) {
      patch({ error: r.error.message });
      return false;
    }
    await select(cupId, true);
    await details(matchId);
    return true;
  }
  return {
    load,
    refresh: () => (state.cups.length ? select(state.cupId, true) : load()),
    select,
    season,
    details,
    recover,
    close: () => {
      ++detailGeneration;
      patch({ matchId: '', rows: null, detailLoading: false });
    },
    dispose: () => {
      ++generation;
      ++detailGeneration;
    },
  };
}
