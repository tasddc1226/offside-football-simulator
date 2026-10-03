import {
  createPlayerMetrics,
  PLAYER_METRICS_KEY,
  type Progress,
} from '@offside/app-core/player-metrics';
import type { OperationResult } from '@offside/app-core/measurement';
import {
  campaignQuery,
  CONSENT_KEY,
  emptyLedger,
  LEDGER_KEY,
  PAGES,
  safeReferrer,
  type Career,
  type Consent,
  type Ledger,
  type Params,
} from './model.js';
import type { createTracker } from './tracker.js';
let metricEpoch = 0;
const playerMetrics = createPlayerMetrics({
  allowed: () => allowed() && loaded && screen !== 'admin',
  read: () => localStorage.getItem(PLAYER_METRICS_KEY),
  write: (raw) => localStorage.setItem(PLAYER_METRICS_KEY, raw),
  send: (name, params) => send(name, { ...params, identity_scope: 'device' }),
});
let metricQueue = Promise.resolve();
function metric(fn: () => void) {
  if (!allowed() || !loaded || screen === 'admin') return;
  const epoch = metricEpoch;
  // No cross-tab read/write race: unavailable locks fail closed for new player milestones.
  if (!navigator.locks) return;
  metricQueue = metricQueue
    .then(() =>
      navigator.locks.request(PLAYER_METRICS_KEY, () => {
        if (epoch === metricEpoch && allowed()) fn();
      }),
    )
    .catch(() => {});
}
const initialOperations: OperationResult[] = [];
export function trackOperation(result: OperationResult) {
  if (!loaded && allowed()) {
    if (initialOperations.length < 20) initialOperations.push(result);
    return;
  }
  send('game_operation', { ...result, data_loss_status: 'unconfirmed' });
}
let tracker: ReturnType<typeof createTracker> | undefined;

declare const __APP_VERSION__: string | undefined;
type TagWindow = Window &
  typeof globalThis & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
const env = import.meta.env;
export { enabled } from './config.js';
import { enabled, id, hostname, prodId } from './config.js';
let consent: Consent = 'unknown';
let initialized = false;
let loaded = false;
let screen = 'home';
let restoredId: string | null = null;
let lastPage = '';
let campaign = '';
let referrer = '';
const listeners = new Set<() => void>();
const w = () => window as TagWindow;
function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : 'unknown';
  } catch {
    return consent;
  }
}
export function getConsent(): Consent {
  return initialized ? consent : 'unknown';
}
export function onConsent(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function tag(...args: unknown[]) {
  try {
    w().gtag?.(...args);
  } catch {
    /* browser blockers */
  }
}
function allowed(): boolean {
  return enabled() && consent === 'granted' && readConsent() === 'granted';
}
function pageParams(): Params {
  const page = PAGES[screen] ?? 'other';
  return {
    page_location: `${location.origin}/${page === 'home' ? '' : page}${campaign}`,
    page_title: `OFFSIDE | ${page}`,
    page_referrer: referrer,
  };
}
function send(event: string, params: Params = {}) {
  if (!allowed() || !loaded || screen === 'admin') return;
  tag('event', event, {
    ...pageParams(),
    measurement_version: '3',
    test_marker: env.VITE_GA4_TEST_MARKER === 'qa' || id !== prodId ? 'qa' : 'live',
    client_platform: 'web',
    app_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    ...params,
    send_to: id,
  });
}
function pageView() {
  if (!allowed() || !loaded || screen === 'admin' || lastPage === screen) return;
  lastPage = screen;
  tag('set', pageParams()); // Also sanitize automatic engagement/session events.
  send('page_view');
}
async function loadTag() {
  if (!allowed()) return;
  // Tracking logic is unnecessary before consent; keep it out of the game's initial payload.
  tracker ??= (await import('./tracker.js')).createTracker(
    {
      allowed,
      read: readLedger,
      write: (l) => localStorage.setItem(LEDGER_KEY, JSON.stringify(l)),
      now: Date.now,
      send,
    },
    restoredId,
  );
  if (!allowed()) return;
  Reflect.set(window, `ga-disable-${id}`, false);
  if (loaded) {
    pageView();
    return;
  }
  loaded = true;
  w().dataLayer ??= [];
  // gtag requires an arguments object rather than an Array for its command queue.
  w().gtag = function () {
    // eslint-disable-next-line prefer-rest-params -- gtag consumes the documented Arguments queue format.
    w().dataLayer!.push(arguments);
  };
  tag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  tag('set', {
    ...pageParams(),
    measurement_version: '3',
    test_marker: env.VITE_GA4_TEST_MARKER === 'qa' || id !== prodId ? 'qa' : 'live',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    url_passthrough: false,
  });
  tag('js', new Date());
  tag('config', id, {
    ...pageParams(),
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: hostname,
    cookie_expires: 60 * 86400,
    cookie_update: false,
    ...(env.VITE_GA4_DEBUG === 'true' && id !== prodId ? { debug_mode: true } : {}),
  });
  const script = document.createElement('script');
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.dataset.offsideAnalytics = 'true';
  script.onerror = () => {
    // Drop this tab's queue on a blocked tag; never persist it or retry a failed load.
    Reflect.set(window, `ga-disable-${id}`, true);
    if (w().dataLayer) w().dataLayer!.length = 0;
    w().gtag = () => {};
  };
  // Consent withdrawal disables an in-flight load too.
  document.head.append(script);
  pageView();
  for (const result of initialOperations.splice(0)) trackOperation(result);
}
function stop() {
  if (!enabled()) return;
  Reflect.set(window, `ga-disable-${id}`, true);
  lastPage = '';
  analytics.reset();
  metricEpoch++;
  initialOperations.length = 0;
  playerMetrics.reset();
  if (w().dataLayer) w().dataLayer!.length = 0;
  try {
    localStorage.removeItem(LEDGER_KEY);
    localStorage.removeItem(PLAYER_METRICS_KEY);
  } catch {
    /* denied storage */
  }
  // Only analytics cookies, never saves, session/recovery keys or other origin storage.
  for (const item of document.cookie.split(';')) {
    const name = item.trim().split('=')[0] ?? '';
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    for (const domain of ['', `; domain=${hostname}`, `; domain=.${hostname}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
    }
  }
}
export function setConsent(value: 'granted' | 'denied') {
  if (!enabled()) return;
  const previous = consent;
  consent = value;
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* choice remains for this tab */
  }
  if (value === 'granted') {
    if (previous !== 'granted') lastPage = '';
    try {
      void loadTag().catch(() => {});
    } catch {
      /* analytics is optional */
    }
  } else stop();
  for (const fn of listeners) fn();
}
export function initializeAnalytics(initialScreen: string, restoredCareerId: string | null = null) {
  if (initialized || !enabled()) return;
  initialized = true;
  restoredId = restoredCareerId;
  screen = initialScreen;
  campaign = campaignQuery(location.href);
  referrer = safeReferrer(document.referrer);
  consent = readConsent();
  for (const fn of listeners) fn();
  window.addEventListener('storage', (e) => {
    if (e.key !== CONSENT_KEY && e.key !== null) return;
    consent = readConsent();
    if (consent === 'granted') {
      try {
        void loadTag().catch(() => {});
      } catch {
        /* optional */
      }
    } else stop();
    for (const fn of listeners) fn();
  });
  if (consent === 'granted') {
    try {
      void loadTag().catch(() => {});
    } catch {
      /* optional */
    }
  }
}
export function trackPage(next: string) {
  if (screen === next) return;
  screen = next;
  // Returning from an excluded screen is still a new navigation.
  if (next === 'admin') lastPage = '';
  pageView();
}
function readLedger(): Ledger {
  const raw = localStorage.getItem(LEDGER_KEY);
  if (!raw) return emptyLedger();
  try {
    const value = JSON.parse(raw) as Ledger;
    if (!value || !Array.isArray(value.entries) || typeof value.seenStart !== 'boolean')
      return emptyLedger();
    if (!value.entries.every((e) => typeof e.id === 'string' && Number.isFinite(e.at)))
      return emptyLedger();
    if (
      value.next &&
      value.next.kind !== 'replace_active' &&
      !(
        value.next.kind === 'after_retirement' &&
        typeof value.next.id === 'string' &&
        typeof value.next.pos === 'string' &&
        typeof value.next.trait === 'string'
      )
    )
      value.next = null;
    return value;
  } catch {
    return emptyLedger();
  }
}
export const analytics = {
  reset: () => tracker?.reset(),
  replace: () => tracker?.replace(),
  start: (s: Career, previous: Career | null) => {
    let eligible = false;
    try {
      const prior = readLedger();
      eligible = !previous && !prior.seenStart && prior.entries.length === 0;
    } catch {
      /* cohort origin stays unknown */
    }
    tracker?.start(s, previous);
    const { cid } = s;
    const year = s.year;
    if (typeof year !== 'number') return;
    metric(() => playerMetrics.start(cid, year, eligible));
  },
  complete: (p: Progress) => {
    const snapshot = { ...p };
    metric(() => playerMetrics.complete(snapshot));
  },
  play: (s: Career, firstAction = false) => tracker?.play(s, firstAction),
  firstSeason: (s: Career) => {
    tracker?.firstSeason(s);
    metric(() => playerMetrics.season());
  },
  retire: (s: Career) => {
    tracker?.retire(s);
    const cid = s.cid;
    metric(() => playerMetrics.retire(cid));
  },
};
export const trackShareClick = () => {
  try {
    send('career_share_click', { share_method: 'copy_link' });
  } catch {
    /* optional */
  }
};
export const trackShareSuccess = () => {
  try {
    send('career_share_copy_success', { share_method: 'copy_link' });
  } catch {
    /* optional */
  }
};
