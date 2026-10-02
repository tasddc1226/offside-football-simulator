/** Native consent boundary. No action replay, retries or game-save writes. */
import { emptyLedger, PAGES, type Consent, type Ledger, type Params } from './analytics-model.js';
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
      // Always close collection before changing SDK consent or clearing queued data.
      await sdk.collect(false);
      if (epoch !== generation || consent !== 'granted') {
        await sdk.consent(false);
        await sdk.reset();
        return;
      }
      await sdk.consent(true);
      if (epoch !== generation || consent !== 'granted') {
        await sdk.consent(false);
        await sdk.reset();
        return;
      }
      await sdk.collect(true);
      if (epoch !== generation || consent !== 'granted') {
        await sdk.collect(false);
        await sdk.consent(false);
        await sdk.reset();
        return;
      }
      ready = true;
      pageView();
    });
  }
  return {
    initialize(initialScreen: string, restoredId: string | null) {
      if (initialized) return;
      initialized = true;
      screen = initialScreen;
      tracker = createTracker(
        {
          allowed,
          read: io.readLedger,
          write: io.writeLedger,
          now: io.now,
          send,
        },
        restoredId,
      );
      try {
        consent = io.readConsent();
      } catch {
        consent = 'unknown';
      }
      if (io.enabled()) syncConsent();
    },
    // Backup restoration does not emit events; only subsequent gameplay may resume.
    restored(id: string | null) {
      tracker = createTracker(
        {
          allowed,
          read: io.readLedger,
          write: io.writeLedger,
          now: io.now,
          send,
        },
        id,
      );
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
      start: (...args: Parameters<ReturnType<typeof createTracker>['start']>) =>
        tracker?.start(...args),
      play: (...args: Parameters<ReturnType<typeof createTracker>['play']>) =>
        tracker?.play(...args),
      firstSeason: (...args: Parameters<ReturnType<typeof createTracker>['firstSeason']>) =>
        tracker?.firstSeason(...args),
      retire: (...args: Parameters<ReturnType<typeof createTracker>['retire']>) =>
        tracker?.retire(...args),
    },
    // Allows deterministic tests and a UI to await SDK shutdown if needed.
    async settled() {
      await pending;
      await pending;
    },
  };
}
