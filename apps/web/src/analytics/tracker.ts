import {
  emptyLedger,
  gameParams,
  prune,
  seasonBucket,
  type Career,
  type Ledger,
  type Params,
} from './model.js';

type IO = {
  allowed: () => boolean;
  read: () => Ledger;
  write: (value: Ledger) => void;
  send: (event: string, params: Params) => void;
  now: () => number;
};
/** Best-effort local dedupe, re-read on every action for other tabs. No retries or game-save writes. */
export function createTracker(io: IO, restoredCareerId: string | null = null) {
  let fallback = emptyLedger();
  const run = (s: Career | null, fn: (ledger: Ledger) => void) => {
    try {
      if (!io.allowed()) return;
      let ledger: Ledger;
      try {
        ledger = io.read();
      } catch {
        ledger = fallback;
      }
      ledger = prune(ledger, io.now(), s?.cid ?? null);
      fn(ledger);
      fallback = ledger;
    } catch {
      /* Analytics must never affect gameplay. */
    }
  };
  const save = (l: Ledger) => {
    fallback = l;
    try {
      io.write(l);
    } catch {
      /* quota/private mode */
    }
  };
  const once = (
    l: Ledger,
    s: Career,
    key: 'start' | 'first' | 'retire' | 'action',
    fn: () => void,
  ) => {
    let e = l.entries.find((e) => e.id === s.cid);
    if (e?.[key]) return;
    if (!e) {
      e = { id: s.cid, at: io.now() };
      l.entries.push(e);
    }
    e[key] = true;
    e.at = io.now();
    save(prune(l, io.now(), s.cid)); // Mark BEFORE handing to the tag, even if blocked/offline.
    fn();
  };
  return {
    reset() {
      fallback = emptyLedger();
    },
    replace() {
      run(null, (l) => {
        l.next = { kind: 'replace_active' };
        save(l);
      });
    },
    start(s: Career, previous: Career | null) {
      restoredCareerId = null;
      run(s, (l) =>
        once(l, s, 'start', () => {
          const prior = l.next;
          const context =
            (previous && !previous.retired) || prior?.kind === 'replace_active'
              ? 'replace_active'
              : prior?.kind === 'after_retirement' && previous?.cid === prior.id
                ? 'after_retirement'
                : !previous && !l.seenStart
                  ? 'first_observed'
                  : 'unknown';
          const changed = (key: 'pos' | 'trait') =>
            context === 'after_retirement' && prior?.kind === 'after_retirement'
              ? String(prior[key] !== s[key])
              : 'unknown';
          const params = {
            ...gameParams(s),
            start_context: context,
            position_changed: changed('pos'),
            trait_changed: changed('trait'),
          };
          l.next = null;
          l.seenStart = true;
          l.entries.find((e) => e.id === s.cid)!.lastActionAt = io.now();
          save(l);
          io.send('career_start', params);
        }),
      );
    },
    play(s: Career, firstAction = false) {
      if (s.retired) return;
      run(s, (l) => {
        let e = l.entries.find((e) => e.id === s.cid);
        const previous = e?.lastActionAt;
        const resume =
          (restoredCareerId === s.cid || Number.isFinite(previous)) &&
          (!Number.isFinite(previous) || io.now() - previous! >= 30 * 60_000);
        if (!e) {
          e = { id: s.cid, at: io.now() };
          l.entries.push(e);
        }
        e.lastActionAt = io.now();
        e.at = io.now();
        save(l); // Advance the activity boundary before sending, including failed sends.
        const params = {
          ...gameParams(s),
          career_origin: e.start ? 'observed_start' : 'preexisting_or_unknown',
        };
        if (firstAction) once(l, s, 'action', () => io.send('first_action_complete', params));
        if (resume)
          io.send('career_resume', {
            ...params,
            completed_seasons_bucket: seasonBucket(s.career.length),
          });
      });
    },
    firstSeason(s: Career) {
      run(s, (l) => {
        const params = {
          ...gameParams(s),
          career_origin: l.entries.find((e) => e.id === s.cid)?.start
            ? 'observed_start'
            : 'preexisting_or_unknown',
        };
        if (s.career.length === 1)
          once(l, s, 'first', () => io.send('first_season_complete', params));
        // Exact, newly completed milestones only; never backfill old saves.
        const milestone = s.career.length;
        if (![3, 5, 10, 20].includes(milestone)) return;
        let e = l.entries.find((e) => e.id === s.cid);
        if (!e) {
          e = { id: s.cid, at: io.now() };
          l.entries.push(e);
        }
        const seen = Array.isArray(e.milestones) ? e.milestones : [];
        if (seen.includes(milestone)) return;
        e.milestones = [...seen, milestone];
        e.at = io.now();
        save(l);
        io.send('career_progress_milestone', { ...params, milestone_seasons: milestone });
      });
    },
    retire(s: Career) {
      run(s, (l) =>
        once(l, s, 'retire', () => {
          l.next = { kind: 'after_retirement', id: s.cid, pos: s.pos, trait: s.trait };
          save(l);
          io.send('career_retire', {
            ...gameParams(s),
            career_origin: l.entries.find((e) => e.id === s.cid)?.start
              ? 'observed_start'
              : 'preexisting_or_unknown',
            completed_seasons_bucket: seasonBucket(s.career.length),
          });
        }),
      );
    },
  };
}
