import {
  fetchCupPredictions,
  fetchCupPredictionsMe,
  putCupPrediction,
  type CupPredictionCounts,
  type CupPredictionMeResponse,
  type CupPredictionPick,
  type CupMatch,
} from './api/cup.js';
import { cupText as L } from './i18n/ko/cup.js';

export type MyCupPrediction = CupPredictionMeResponse['items'][number];
export interface CupPredictionState {
  status: 'loading' | 'ready' | 'error';
  counts: Record<string, CupPredictionCounts>;
  mine: Record<string, MyCupPrediction>;
  personalFailed: boolean;
  busy: string | null;
  error: string | null;
  errorMatch: string | null;
}
export const emptyCupPredictions = (): CupPredictionState => ({
  status: 'loading',
  counts: {},
  mine: {},
  personalFailed: false,
  busy: null,
  error: null,
  errorMatch: null,
});
export const predictionChoices = (m: Pick<CupMatch, 'round'>): CupPredictionPick[] =>
  ['g1', 'g2', 'g3'].includes(m.round) ? ['home', 'draw', 'away'] : ['home', 'away'];
export const predictionOpen = (m: CupMatch, now: number) =>
  !m.played && !!m.homeTeamId && !!m.awayTeamId && Date.parse(m.at) > now;

/** Largest remainder rounding keeps non-empty vote shares at exactly 100%. Zero votes stay zero. */
export function predictionPercentages(
  c: CupPredictionCounts | undefined,
): Record<CupPredictionPick, number> {
  const keys: CupPredictionPick[] = ['home', 'draw', 'away'];
  const total = c ? c.home + c.draw + c.away : 0;
  if (!c || !total) return { home: 0, draw: 0, away: 0 };
  const exact = keys.map((k) => (c[k] * 100) / total);
  const out = exact.map(Math.floor);
  const order = keys.map((_, i) => i).sort((a, b) => exact[b]! - out[b]! - (exact[a]! - out[a]!));
  const remaining = 100 - out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) {
    // Remaining points are at most two.
    out[order[i]!]!++;
  }
  return { home: out[0]!, draw: out[1]!, away: out[2]! };
}

/** One batch read per cup, no per-row requests or polling. Scope guards prevent stale account updates. */
export function createCupPredictionController(changed: (s: CupPredictionState) => void) {
  let state = emptyCupPredictions();
  let generation = 0;
  let cupId = '';
  let linked = false;
  const publish = (patch: Partial<CupPredictionState>) => {
    state = { ...state, ...patch };
    changed(state);
  };
  return {
    async load(id: string, member: boolean) {
      const scope = ++generation;
      cupId = id;
      linked = member;
      state = emptyCupPredictions();
      changed(state);
      const [publicResult, personal] = await Promise.all([
        fetchCupPredictions(id),
        member ? fetchCupPredictionsMe(id) : null,
      ]);
      if (scope !== generation) return;
      publish({
        status: publicResult.ok ? 'ready' : 'error',
        counts: publicResult.ok
          ? Object.fromEntries(publicResult.data.items.map((x) => [x.matchId, x]))
          : {},
        mine: personal?.ok
          ? Object.fromEntries(personal.data.items.map((x) => [x.matchId, x]))
          : {},
        personalFailed: !!personal && !personal.ok,
      });
    },
    async pick(matchId: string, pick: CupPredictionPick) {
      if (!linked || state.busy || state.personalFailed || state.status !== 'ready') return;
      const scope = generation;
      publish({ busy: matchId, error: null, errorMatch: null });
      const r = await putCupPrediction(cupId, matchId, pick);
      if (scope !== generation) return;
      if (!r.ok) {
        publish({ busy: null, errorMatch: matchId, error: r.error.message || L.predictionFail });
        return;
      }
      publish({
        busy: null,
        counts: { ...state.counts, [matchId]: r.data },
        mine: { ...state.mine, [matchId]: { matchId, pick, correct: null, rewarded: false } },
      });
    },
    cancel() {
      generation++;
    },
  };
}

export interface CupPredictionContext {
  state: CupPredictionState;
  linked: boolean;
  now: number;
  pick: (matchId: string, choice: CupPredictionPick) => void;
  team: (teamId: string) => void;
}
