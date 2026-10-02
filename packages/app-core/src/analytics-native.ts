/** Native consent boundary. No action replay, retries or game-save writes. */
import {
  emptyLedger,
  PAGES,
  type Career,
  type Consent,
  type Ledger,
  type Params,
} from './analytics-model.js';
import { createTracker } from './analytics-tracker.js';

export type NativeAnalyticsSDK = {
  consent(granted: boolean): Promise<void>;
  collect(enabled: boolean): Promise<void>;
  reset(): Promise<void>;
  event(name: string, params: Params): Promise<void>;
};
type IO = {
  enabled: () => boolean;
  load: () => Promise<NativeAnalyticsSDK | null>;
  readConsent: () => Consent;
  writeConsent: (v: Consent) => void;
  readLedger: () => Ledger;
  writeLedger: (v: Ledger) => void;
  now: () => number;
  appVersion: string;
};
export function createNativeAnalytics(io: IO) {
  let consent: Consent = 'unknown';
  let initialized = false;
  let ready = false;
  let generation = 0;
  let screen = 'home';
  let lastPage = '';
  let sdk: NativeAnalyticsSDK | null = null;
  let tracker: ReturnType<typeof createTracker> | undefined;
  let pending = Promise.resolve();
  const listeners = new Set<() => void>();
  const allowed = () => io.enabled() && consent === 'granted' && ready;
  // Serialized SDK access; stale sends are dropped when the user withdraws consent.
  function enqueue(fn: () => Promise<void>) {
    pending = pending.then(fn).catch(async () => {
      ready = false;
      // Independent shutdown attempts: a failing collection call must not skip denial.
      await sdk?.collect(false).catch(() => {});
      await sdk?.consent(false).catch(() => {});
      await sdk?.reset().catch(() => {});
    });
  }
  function send(name: string, params: Params = {}) {
    if (!allowed() || screen === 'admin') return;
    const epoch = generation;
    const data = { measurement_version: '2', app_version: io.appVersion, ...params };
    enqueue(async () => {
      if (epoch === generation && allowed()) await sdk?.event(name, data);
    });
  }
  function pageView() {
    if (!allowed() || screen === 'admin' || lastPage === screen) return;
    lastPage = screen;
    send('screen_view', { screen_name: PAGES[screen] ?? 'other', screen_class: 'OFFSIDE' });
  }
  function syncConsent() {
    const epoch = generation;
    enqueue(async () => {
      sdk ??= await io.load();
      if (!sdk) return;
      const s = sdk;
      const stale = () => epoch !== generation || consent !== 'granted';
      const deny = async () => {
        await s.consent(false);
        await s.reset();
      };
      // Always close collection before changing SDK consent or clearing queued data.
      await s.collect(false);
      if (stale()) return deny();
      await s.consent(true);
      if (stale()) return deny();
      await s.collect(true);
      if (stale()) {
        await s.collect(false);
        return deny();
      }
      ready = true;
      pageView();
    });
  }
  const makeTracker = (id: string | null) =>
    createTracker({ allowed, read: io.readLedger, write: io.writeLedger, now: io.now, send }, id);
  return {
    initialize(initialScreen: string, restoredId: string | null) {
      if (initialized) return;
      initialized = true;
      screen = initialScreen;
      tracker = makeTracker(restoredId);
      try {
        consent = io.readConsent();
      } catch {
        consent = 'unknown';
      }
      if (io.enabled()) syncConsent();
    },
    // Backup restoration does not emit events; only subsequent gameplay may resume.
    restored(id: string | null) {
      tracker = makeTracker(id);
    },
    enabled: io.enabled,
    getConsent: () => consent,
    onConsent(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setConsent(value: 'granted' | 'denied') {
      if (!io.enabled() || value === consent) return;
      generation++;
      ready = false;
      lastPage = '';
      consent = value;
      try {
        io.writeConsent(value);
      } catch {
        // Never persist SDK opt-in if the corresponding app choice cannot be saved.
        if (value === 'granted') consent = 'unknown';
      }
      if (consent !== 'granted') {
        tracker?.reset();
        try {
          io.writeLedger(emptyLedger());
        } catch {
          /* optional storage */
        }
      }
      syncConsent();
      for (const fn of listeners) fn();
    },
    trackPage(next: string) {
      if (next === screen) return;
      screen = next;
      if (screen === 'admin') lastPage = '';
      pageView();
    },
    analytics: {
      replace: () => tracker?.replace(),
      start: (s: Career, previous: Career | null) => tracker?.start(s, previous),
      play: (s: Career, firstAction = false) => tracker?.play(s, firstAction),
      firstSeason: (s: Career) => tracker?.firstSeason(s),
      retire: (s: Career) => tracker?.retire(s),
    },
    // Tests await SDK shutdown through this.
    async settled() {
      await pending;
      await pending;
    },
  };
}
