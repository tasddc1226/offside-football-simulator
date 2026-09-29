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
export function createTracker(io: IO) {
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
  const once = (l: Ledger, s: Career, key: 'start' | 'first' | 'retire', fn: () => void) => {
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
          save(l);
          io.send('career_start', params);
        }),
      );
    },
    firstSeason(s: Career) {
      if (s.career.length !== 1) return;
      run(s, (l) =>
        once(l, s, 'first', () =>
          io.send('first_season_complete', {
            ...gameParams(s),
            career_origin: l.entries.find((e) => e.id === s.cid)?.start
              ? 'observed_start'
              : 'preexisting_or_unknown',
          }),
        ),
      );
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
