/** Player milestones live outside saves/backups. Caller serializes writes across tabs. */
export const PLAYER_METRICS_KEY = 'offside_player_metrics_v1';
export type MetricParams = Record<string, string | number | boolean>;
export type Progress = { cid: string; year: number; phase: number; matches: number };
type Mark = { cid: string; year: number; phase: number; created?: boolean };
export type PlayerLedger = {
  v: 1;
  firstPlay?: 'observed_new' | 'preexisting_or_unknown';
  firstSeason?: boolean;
  firstRetire?: boolean;
  retireOrigin?: 'observed_new' | 'preexisting_or_unknown';
  restart?: boolean;
  marks: Mark[];
};
export const emptyPlayerLedger = (): PlayerLedger => ({ v: 1, marks: [] });
export function parsePlayerLedger(raw: string | null): PlayerLedger {
  try {
    const l = JSON.parse(raw ?? 'null') as PlayerLedger;
    if (
      l?.v !== 1 ||
      !Array.isArray(l.marks) ||
      !l.marks.every(
        (m) => typeof m.cid === 'string' && Number.isFinite(m.year) && Number.isFinite(m.phase),
      )
    )
      return emptyPlayerLedger();
    if (
      l.firstPlay !== undefined &&
      !['observed_new', 'preexisting_or_unknown'].includes(l.firstPlay)
    )
      return emptyPlayerLedger();
    if (
      l.retireOrigin !== undefined &&
      !['observed_new', 'preexisting_or_unknown'].includes(l.retireOrigin)
    )
      return emptyPlayerLedger();
    if (
      [l.firstSeason, l.firstRetire, l.restart, ...l.marks.map((m) => m.created)].some(
        (value) => value !== undefined && typeof value !== 'boolean',
      )
    )
      return emptyPlayerLedger();
    return l;
  } catch {
    return emptyPlayerLedger();
  }
}
export function createPlayerMetrics(io: {
  allowed(): boolean;
  read(): string | null;
  write(raw: string): void;
  send(name: string, params: MetricParams): void;
}) {
  let fallback = emptyPlayerLedger();
  const run = (
    fn: (l: PlayerLedger, emit: (name: string, params?: MetricParams) => void) => void,
  ) => {
    try {
      if (!io.allowed()) return;
      let l = fallback;
      try {
        const stored = parsePlayerLedger(io.read());
        // Keep the in-memory boundary even if storage is readable but writes fail.
        l = { ...stored, ...fallback, marks: [...stored.marks, ...fallback.marks] };
        if (stored.firstPlay) l.firstPlay = stored.firstPlay;
        if (stored.firstSeason) l.firstSeason = true;
        if (stored.firstRetire) l.firstRetire = true;
        if (stored.retireOrigin) l.retireOrigin = stored.retireOrigin;
        if (stored.restart) l.restart = true;
      } catch {
        /* memory fallback */
      }
      const events: { name: string; params: MetricParams }[] = [];
      const marks = new Map<string, Mark>();
      for (const m of l.marks) {
        const old = marks.get(m.cid);
        if (!old) marks.set(m.cid, { ...m });
        else {
          if (m.created) old.created = true;
          if (m.year > old.year || (m.year === old.year && m.phase > old.phase)) {
            old.year = m.year;
            old.phase = m.phase;
          }
        }
      }
      l.marks = [...marks.values()].slice(-200);
      fn(l, (name, params = {}) => events.push({ name, params }));
      l.marks = l.marks.slice(-200);
      fallback = l;
      try {
        io.write(JSON.stringify(l));
      } catch {
        /* memory fallback */
      }
      // Mark before handing to the tag; never retry or backfill.
      for (const e of events) {
        try {
          io.send(e.name, e.params);
        } catch {
          /* optional */
        }
      }
    } catch {
      /* optional */
    }
  };
  return {
    reset() {
      fallback = emptyPlayerLedger();
    },
    start(cid: string, year: number, eligible = true) {
      run((l, emit) => {
        if (l.marks.some((m) => m.cid === cid)) return;
        l.marks.push({ cid, year, phase: -1, created: eligible });
        if (l.firstRetire && !l.restart) {
          l.restart = true;
          emit('player_restart', { cohort_origin: l.retireOrigin ?? 'preexisting_or_unknown' });
        }
      });
    },
    complete(p: Progress) {
      if (p.matches <= 0 || p.phase < 1 || p.phase > 2) return;
      run((l, emit) => {
        const mark = l.marks.find((m) => m.cid === p.cid);
        if (mark && (mark.year > p.year || (mark.year === p.year && mark.phase >= p.phase))) return;
        if (!l.firstPlay) {
          l.firstPlay = mark?.created ? 'observed_new' : 'preexisting_or_unknown';
          emit('player_first_play', { cohort_origin: l.firstPlay });
        }
        emit('play_complete', { play_unit: 'league_half', cohort_origin: l.firstPlay });
        if (mark) {
          mark.year = p.year;
          mark.phase = p.phase;
        } else l.marks.push({ cid: p.cid, year: p.year, phase: p.phase });
      });
    },
    season() {
      run((l, emit) => {
        if (!l.firstPlay || l.firstSeason) return;
        l.firstSeason = true;
        emit('player_first_season', { cohort_origin: l.firstPlay });
      });
    },
    retire(cid?: string) {
      run((l, emit) => {
        if (l.firstRetire) return;
        l.firstRetire = true;
        l.retireOrigin =
          l.firstPlay ??
          (l.marks.find((m) => m.cid === cid)?.created ? 'observed_new' : 'preexisting_or_unknown');
        emit('player_first_retire', { cohort_origin: l.retireOrigin });
      });
    },
  };
}
