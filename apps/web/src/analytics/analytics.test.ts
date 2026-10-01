import { describe, expect, it } from 'vitest';
import {
  campaignQuery,
  emptyLedger,
  gameParams,
  prune,
  safeReferrer,
  type Career,
  type Params,
} from './model.js';
import { createTracker } from './tracker.js';
const career = (cid = 'local-only-uuid'): Career => ({
  cid,
  pos: 'FW',
  trait: 'late',
  bal: { v: 7 },
  career: [],
  retired: false,
});
function setup() {
  let consent = true;
  let ledger = emptyLedger();
  const events: { name: string; params: Params }[] = [];
  const io = {
    allowed: () => consent,
    read: () => structuredClone(ledger),
    write: (v: typeof ledger) => {
      ledger = structuredClone(v);
    },
    now: () => 1700000000000,
    send: (name: string, params: Params) => {
      events.push({ name, params });
    },
  };
  return {
    io,
    tracker: createTracker(io),
    events,
    deny: () => {
      consent = false;
    },
    grant: () => {
      consent = true;
    },
    state: () => ledger,
  };
}
describe('privacy allowlists', () => {
  it.each(['threads', 'instagram'])('preserves registered season1 tags from %s only', (source) => {
    for (const content of [
      's1_story_01',
      's1_story_02',
      's1_choice_01',
      's1_choice_02',
      's1_update_01',
      's1_update_02',
      's1_bio',
      's1_ig_story_01',
    ]) {
      const query = `?utm_source=${source}&utm_medium=social&utm_campaign=season1_launch&utm_content=${content}`;
      expect(
        campaignQuery(`https://offside-lab.com/${query}&email=PRIVATE&gclid=PRIVATE#PRIVATE`),
      ).toBe(query);
    }
    expect(
      campaignQuery(
        `https://offside-lab.com/?utm_campaign=season1_launch&utm_content=s1_unknown&player=PRIVATE`,
      ),
    ).toBe('?utm_campaign=season1_launch');
  });
  it.each(['launch', 'retirement_share'])(
    'preserves existing campaign %s and content',
    (campaign) => {
      for (const content of ['career', 'retirement', 'feedback', 'update', 'day5']) {
        const query = `?utm_source=threads&utm_medium=social&utm_campaign=${campaign}&utm_content=${content}`;
        expect(campaignQuery(`https://offside-lab.com/${query}`)).toBe(query);
      }
    },
  );
  it('drops arbitrary query, OAuth, campaign values, fragment and referral path', () => {
    expect(
      campaignQuery(
        'https://offside-lab.com/career/private-id?code=secret&email=me@example.com&utm_source=threads&utm_medium=social&utm_campaign=launch&utm_content=me@example.com#gclid=secret',
      ),
    ).toBe('?utm_source=threads&utm_medium=social&utm_campaign=launch');
    expect(campaignQuery('https://offside-lab.com/?utm_source=me@example.com')).toBe('');
    expect(safeReferrer('https://www.threads.com/@person/post/id?token=secret')).toBe(
      'https://threads.com/',
    );
    expect(safeReferrer('https://person.example.com/private')).toBe('');
    expect(safeReferrer('https://threads.com.evil.example/')).toBe('');
    expect(safeReferrer('not a url')).toBe('');
  });
  it('never forwards game objects, IDs or unknown free text', () => {
    expect(
      gameParams({ ...career(), pos: 'real-name', trait: 'email@example.com', bal: { v: NaN } }),
    ).toEqual({ position: 'unknown', player_trait: 'unknown', balance_version: 'unknown' });
  });
});
describe('career boundaries', () => {
  it('dedupes start, first school season and actual retirement across reloads and tabs', () => {
    const h = setup(),
      s = career();
    h.tracker.start(s, null);
    h.tracker.start(s, null);
    s.career.push({});
    h.tracker.firstSeason(s);
    const tab = createTracker(h.io);
    tab.firstSeason(s);
    s.career.push({});
    tab.firstSeason(s);
    s.retired = true;
    tab.retire(s);
    h.tracker.retire(s);
    expect(h.events.map((e) => e.name)).toEqual([
      'career_start',
      'first_season_complete',
      'career_retire',
    ]);
    expect(h.events[1]?.params.career_origin).toBe('observed_start');
    expect(JSON.stringify(h.events)).not.toContain(s.cid);
  });
  it('consumes after_retirement once; replacement has its own context', () => {
    const h = setup(),
      s = career();
    h.tracker.start(s, null);
    s.retired = true;
    h.tracker.retire(s);
    const next = { ...career('second'), pos: 'GK' };
    h.tracker.start(next, s);
    expect(h.events.at(-1)?.params).toMatchObject({
      start_context: 'after_retirement',
      position_changed: 'true',
      trait_changed: 'false',
    });
    h.tracker.replace();
    h.tracker.start(career('third'), null);
    expect(h.events.at(-1)?.params).toMatchObject({
      start_context: 'replace_active',
      position_changed: 'unknown',
      trait_changed: 'unknown',
    });
    h.tracker.start(career('fourth'), null);
    expect(h.events.at(-1)?.params.start_context).toBe('unknown');
  });
  it('does not backfill actions before consent or treat preexisting careers as observed starts', () => {
    const h = setup(),
      s = career();
    h.deny();
    h.tracker.start(s, null);
    s.career.push({});
    h.tracker.firstSeason(s);
    expect(h.state()).toEqual(emptyLedger());
    h.grant();
    expect(h.events).toEqual([]);
    s.career.push({});
    h.tracker.firstSeason(s);
    s.retired = true;
    h.tracker.retire(s);
    expect(h.events).toHaveLength(1);
    expect(h.events[0]?.params.career_origin).toBe('preexisting_or_unknown');
  });
  it('survives denied storage and tag failure without blocking gameplay or retrying', () => {
    const h = setup();
    let attempts = 0;
    const t = createTracker({
      ...h.io,
      read: () => {
        throw new Error('storage');
      },
      write: () => {
        throw new Error('quota');
      },
      send: () => {
        attempts++;
        throw new Error('tag');
      },
    });
    expect(() => {
      t.start(career(), null);
      t.start(career(), null);
    }).not.toThrow();
    expect(attempts).toBe(1);
  });
  it('keeps active career and at most 200 recent entries; expires old retirement context', () => {
    const l = emptyLedger(),
      now = 40 * 86400000;
    l.entries = Array.from({ length: 220 }, (_, i) => ({ id: String(i), at: now - i }));
    l.entries.push({ id: 'active', at: 0 });
    l.entries.push({ id: 'old', at: 0 });
    l.next = { kind: 'after_retirement', id: 'old', pos: 'FW', trait: 'late' };
    prune(l, now, 'active');
    expect(l.entries).toHaveLength(201);
    expect(l.entries[0]?.id).toBe('active');
    expect(l.next).toBeNull();
  });
});

describe('priority-one gameplay measurement', () => {
  it('records first actual phase once, never on creation or a later phase', () => {
    const h = setup(),
      s = career();
    h.tracker.start(s, null);
    expect(h.events.map((e) => e.name)).toEqual(['career_start']);
    h.tracker.play(s, true);
    createTracker(h.io).play(s, true);
    h.tracker.play(s);
    expect(h.events.filter((e) => e.name === 'first_action_complete')).toHaveLength(1);
    expect(h.events.some((e) => e.name === 'career_resume')).toBe(false);
    const old = career('old');
    h.tracker.play(old);
    expect(h.events.filter((e) => e.name === 'first_action_complete')).toHaveLength(1);
  });
  it('does not replay a first action taken before consent, even after a reload', () => {
    const h = setup(),
      s = career();
    h.deny();
    h.tracker.play(s, true);
    h.grant();
    createTracker(h.io, s.cid).play(s);
    expect(h.events.map((e) => e.name)).toEqual(['career_resume']);
    expect(h.events[0]?.params.career_origin).toBe('preexisting_or_unknown');
  });
  it('only records exact 3/5/10/20 season completions and dedupes across tabs', () => {
    const h = setup(),
      s = career();
    h.tracker.start(s, null);
    for (const n of [2, 3, 3, 4, 5, 10, 20, 21]) {
      s.career = Array.from({ length: n }, () => ({}));
      createTracker(h.io).firstSeason(s);
    }
    const events = h.events.filter((e) => e.name === 'career_progress_milestone');
    expect(events.map((e) => e.params.milestone_seasons)).toEqual([3, 5, 10, 20]);
    expect(events.every((e) => e.params.career_origin === 'observed_start')).toBe(true);
    expect(JSON.stringify(events)).not.toContain(s.cid);
    const old = { ...career('old'), career: Array.from({ length: 11 }, () => ({})) };
    h.tracker.firstSeason(old);
    expect(h.events.filter((e) => e.name === 'career_progress_milestone')).toHaveLength(4);
  });
  it('requires gameplay on a restored career, suppresses reloads and resumes after 30 minutes', () => {
    const h = setup(),
      s = career();
    let now = 1700000000000;
    const io = { ...h.io, now: () => now };
    const restored = createTracker(io, s.cid);
    expect(h.events).toEqual([]); // Loading, opening screens, and continue alone do not count.
    restored.play(s);
    expect(h.events.map((e) => e.name)).toEqual(['career_resume']);
    now += 60_000;
    createTracker(io, s.cid).play(s);
    expect(h.events).toHaveLength(1);
    now += 30 * 60_000 - 1;
    restored.play(s);
    expect(h.events).toHaveLength(1);
    now += 30 * 60_000;
    restored.play(s);
    expect(h.events).toHaveLength(2);
    s.retired = true;
    now += 30 * 60_000;
    restored.play(s);
    expect(h.events).toHaveLength(2);
  });
  it('does not mistake a replacement career for the restored career', () => {
    const h = setup(),
      s = career();
    const t = createTracker(h.io, 'old');
    t.start(s, career('old'));
    t.play(s, true);
    expect(h.events.map((e) => e.name)).toEqual(['career_start', 'first_action_complete']);
  });
  it('marks milestones before failing transmission and accepts older ledger entries', () => {
    const h = setup(),
      s = career();
    h.io.write({
      seenStart: true,
      next: null,
      entries: [{ id: s.cid, at: 1700000000000, start: true }],
    });
    let attempts = 0;
    const t = createTracker({
      ...h.io,
      send: () => {
        attempts++;
        throw new Error('blocked');
      },
    });
    s.career = [{}, {}, {}];
    expect(() => t.firstSeason(s)).not.toThrow();
    t.firstSeason(s);
    expect(attempts).toBe(1);
  });
});
