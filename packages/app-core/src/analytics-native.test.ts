import { describe, it, expect, vi } from 'vitest';
import { createNativeAnalytics, type NativeAnalyticsSDK } from './analytics-native.js';
import { emptyLedger, type Consent, type Params } from './analytics-model.js';
const career = (cid = 'PRIVATE-ID') => ({
  cid,
  pos: 'FW',
  trait: 'late',
  career: [] as unknown[],
  retired: false,
});
function setup(options: { missing?: boolean; disabled?: boolean; initial?: Consent } = {}) {
  let consent: Consent = options.initial ?? 'unknown';
  let ledger = emptyLedger();
  const events: { name: string; params: Params }[] = [];
  const sdk: NativeAnalyticsSDK = {
    consent: vi.fn(async () => {}),
    collect: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
    event: vi.fn(async (name, params) => {
      events.push({ name, params });
    }),
  };
  const io = {
    enabled: () => !options.disabled,
    load: vi.fn(async () => (options.missing ? null : sdk)),
    readConsent: () => consent,
    writeConsent: (v: Consent) => {
      consent = v;
    },
    readLedger: () => structuredClone(ledger),
    writeLedger: (v: typeof ledger) => {
      ledger = structuredClone(v);
    },
    now: () => 1700000000000,
    appVersion: '1.0.0',
  };
  const a = createNativeAnalytics(io);
  a.initialize('home', 'restored');
  return { a, sdk, events, io };
}
describe('native consent and transport', () => {
  it.each(['unknown', 'denied'] as const)(
    'sends nothing before explicit grant (%s)',
    async (initial) => {
      const h = setup({ initial });
      await h.a.settled();
      h.a.analytics.start(career(), null);
      h.a.analytics.play(career(), true);
      h.a.trackPage('game');
      await h.a.settled();
      expect(h.events).toEqual([]);
      expect(h.sdk.collect).not.toHaveBeenCalledWith(true);
      h.a.setConsent('granted');
      await h.a.settled();
      expect(h.events.map((e) => e.name)).toEqual(['screen_view']);
    },
  );
  it('dedupes all shared events over relaunch; never forwards IDs or arbitrary screens', async () => {
    const h = setup({ initial: 'granted' });
    await h.a.settled();
    const s = career();
    h.a.analytics.start(s, null);
    h.a.analytics.play(s, true);
    s.career = [{}];
    h.a.analytics.firstSeason(s);
    s.career = [{}, {}, {}];
    h.a.analytics.firstSeason(s);
    s.retired = true;
    h.a.analytics.retire(s);
    await h.a.settled();
    const next = createNativeAnalytics(h.io);
    next.initialize('PRIVATE-SCREEN?email=PRIVATE', s.cid);
    await next.settled();
    next.analytics.start(s, null);
    next.analytics.play(s, true);
    next.analytics.firstSeason(s);
    next.analytics.retire(s);
    await next.settled();
    expect(h.events.map((e) => e.name)).toEqual([
      'screen_view',
      'career_start',
      'first_action_complete',
      'first_season_complete',
      'career_progress_milestone',
      'career_retire',
      'screen_view',
    ]);
    expect(JSON.stringify(h.events)).not.toContain('PRIVATE');
    expect(h.events.at(-1)?.params.screen_name).toBe('other');
  });
  it('drops queued sends immediately on withdrawal, disables SDK, and clears analytics only', async () => {
    const h = setup({ initial: 'granted' });
    await h.a.settled();
    h.events.length = 0;
    h.a.analytics.start(career(), null);
    h.a.setConsent('denied');
    h.a.analytics.play(career(), true);
    h.a.trackPage('game');
    await h.a.settled();
    expect(h.events).toEqual([]);
    expect(h.sdk.collect).toHaveBeenLastCalledWith(false);
    expect(h.sdk.consent).toHaveBeenLastCalledWith(false);
    expect(h.sdk.reset).toHaveBeenCalled();
    expect(h.io.readConsent()).toBe('denied');
    expect(h.io.readLedger()).toEqual(emptyLedger());
  });
  it('withdrawal during SDK initialization cannot enable collection', async () => {
    const h = setup();
    await h.a.settled();
    let release!: () => void;
    h.sdk.consent = vi.fn(async (value) => {
      if (value)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    });
    h.a.setConsent('granted');
    await vi.waitFor(() => expect(release).toBeDefined());
    h.a.setConsent('denied');
    release();
    await h.a.settled();
    expect(h.sdk.collect).not.toHaveBeenCalledWith(true);
    expect(h.events).toEqual([]);
  });
  it('rapid consent changes end in the latest state without replay', async () => {
    const h = setup();
    h.a.setConsent('granted');
    h.a.setConsent('denied');
    h.a.setConsent('granted');
    await h.a.settled();
    expect(h.sdk.collect).toHaveBeenLastCalledWith(true);
    expect(h.events.map((e) => e.name)).toEqual(['screen_view']);
  });
  it.each([{ missing: true }, { disabled: true }])(
    'handles absent SDK/configuration safely %j',
    async (options) => {
      const h = setup({ ...options, initial: 'granted' });
      await h.a.settled();
      expect(() => h.a.analytics.start(career(), null)).not.toThrow();
      await h.a.settled();
      expect(h.events).toEqual([]);
      expect(h.io.readLedger()).toEqual(emptyLedger());
    },
  );
  it('does not grant when consent persistence fails', async () => {
    const h = setup();
    await h.a.settled();
    h.io.writeConsent = () => {
      throw new Error('storage');
    };
    h.a.setConsent('granted');
    await h.a.settled();
    expect(h.a.getConsent()).toBe('unknown');
    expect(h.sdk.collect).not.toHaveBeenCalledWith(true);
  });
  it('SDK errors never break gameplay or retry failed events', async () => {
    const h = setup({ initial: 'granted' });
    await h.a.settled();
    h.sdk.event = vi.fn(async () => {
      throw new Error('native failure');
    });
    expect(() => h.a.analytics.start(career(), null)).not.toThrow();
    await h.a.settled();
    h.a.analytics.start(career(), null);
    await h.a.settled();
    expect(h.sdk.event).toHaveBeenCalledTimes(1);
  });
  it('screens dedupe, exclude admin, and restored gameplay counts only after acting', async () => {
    const h = setup({ initial: 'granted' });
    await h.a.settled();
    h.a.trackPage('home');
    h.a.trackPage('admin');
    h.a.trackPage('home');
    h.a.restored('backup');
    await h.a.settled();
    expect(h.events.map((e) => e.name)).toEqual(['screen_view', 'screen_view']);
    h.a.analytics.play(career('backup'));
    await h.a.settled();
    expect(h.events.at(-1)?.name).toBe('career_resume');
  });
});

it('still denies SDK consent when collection shutdown rejects', async () => {
  const h = setup({ initial: 'granted' });
  await h.a.settled();
  h.sdk.collect = vi.fn(async () => {
    throw new Error('native shutdown');
  });
  h.a.setConsent('denied');
  await h.a.settled();
  expect(h.sdk.consent).toHaveBeenLastCalledWith(false);
  expect(h.sdk.reset).toHaveBeenCalled();
  h.a.analytics.start(career(), null);
  await h.a.settled();
  expect(h.events.map((e) => e.name)).toEqual(['screen_view']);
});
