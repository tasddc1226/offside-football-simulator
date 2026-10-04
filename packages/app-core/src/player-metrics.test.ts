import { describe, expect, it } from 'vitest';
import { createPlayerMetrics, type MetricParams } from './player-metrics.js';
function setup() {
  let raw: string | null = null,
    allowed = true;
  const events: { name: string; params: MetricParams }[] = [];
  const io = {
    allowed: () => allowed,
    read: () => raw,
    write: (v: string) => {
      raw = v;
    },
    send: (name: string, params: MetricParams) => {
      events.push({ name, params });
    },
  };
  return {
    io,
    events,
    create: () => createPlayerMetrics(io),
    deny: () => {
      allowed = false;
    },
    grant: () => {
      allowed = true;
    },
  };
}
const phase = (cid = 'private-cid', year = 2030, ph = 1) => ({ cid, year, phase: ph, matches: 10 });
describe('player milestones and real league completion', () => {
  it('excludes creation, preseason, load and repeated/restored progress; counts every new half', () => {
    const h = setup(),
      a = h.create(),
      b = h.create();
    a.start('private-cid', 2030);
    a.complete({ ...phase(), phase: 0, matches: 0 });
    expect(h.events).toEqual([]);
    a.complete(phase());
    b.complete(phase());
    a.complete(phase());
    b.complete(phase('private-cid', 2030, 2));
    a.complete(phase()); // older backup
    a.complete(phase('private-cid', 2031));
    expect(h.events.map((e) => e.name)).toEqual([
      'player_first_play',
      'play_complete',
      'play_complete',
      'play_complete',
    ]);
    expect(h.events[0]?.params.cohort_origin).toBe('observed_new');
    expect(JSON.stringify(h.events)).not.toContain('private-cid');
  });
  it('records user milestones only once across multiple players, reloads and tabs', () => {
    const h = setup();
    h.create().start('one', 2030);
    h.create().complete(phase('one'));
    h.create().season();
    h.create().season();
    h.create().retire();
    h.create().retire();
    h.create().start('two', 2030);
    h.create().start('three', 2030);
    h.create().complete(phase('two'));
    h.create().season();
    expect(h.events.filter((e) => e.name.startsWith('player_')).map((e) => e.name)).toEqual([
      'player_first_play',
      'player_first_season',
      'player_first_retire',
      'player_restart',
    ]);
  });
  it('does not replay pre-consent actions; marks old saves as unknown cohorts', () => {
    const h = setup(),
      a = h.create();
    h.deny();
    a.start('old', 2030);
    a.complete(phase('old'));
    a.season();
    a.retire();
    expect(h.events).toEqual([]);
    expect(h.io.read()).toBeNull();
    h.grant();
    a.season();
    expect(h.events).toEqual([]);
    a.complete(phase('old', 2030, 2));
    expect(h.events[0]?.params.cohort_origin).toBe('preexisting_or_unknown');
  });
  it('keeps in-memory dedupe with readable but unwritable storage and failed delivery', () => {
    const h = setup();
    let attempts = 0;
    const a = createPlayerMetrics({
      ...h.io,
      write: () => {
        throw Error('quota');
      },
      send: () => {
        attempts++;
        throw Error('offline');
      },
    });
    a.complete(phase());
    a.complete(phase());
    a.retire();
    a.retire();
    expect(attempts).toBe(3); // first play, half, first retire; no retry
  });
  it('fails safely on corrupt ledger, unavailable storage or analytics exceptions', () => {
    const h = setup(),
      a = createPlayerMetrics({
        ...h.io,
        read: () => '{broken',
        write: () => {
          throw Error('storage');
        },
      });
    expect(() => a.complete(phase())).not.toThrow();
    a.complete(phase());
    expect(h.events).toHaveLength(2);
  });
});
