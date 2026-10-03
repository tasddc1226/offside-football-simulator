import {
  campaignQuery,
  CONSENT_KEY,
  LEDGER_KEY,
  PAGES,
  parseConsent,
  parseLedger,
  safeReferrer,
  type Career,
  type Consent,
  type Ledger,
  type Params,
} from '@offside/app-core/analytics-model';
import type { createTracker } from '@offside/app-core/analytics-tracker';
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
    return parseConsent(localStorage.getItem(CONSENT_KEY));
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
    measurement_version: '2',
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
  tracker ??= (await import('@offside/app-core/analytics-tracker')).createTracker(
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
}
function stop() {
  if (!enabled()) return;
  Reflect.set(window, `ga-disable-${id}`, true);
  lastPage = '';
  analytics.reset();
  if (w().dataLayer) w().dataLayer!.length = 0;
  try {
    localStorage.removeItem(LEDGER_KEY);
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
  return parseLedger(localStorage.getItem(LEDGER_KEY));
}
export const analytics = {
  reset: () => tracker?.reset(),
  replace: () => tracker?.replace(),
  start: (s: Career, previous: Career | null) => tracker?.start(s, previous),
  play: (s: Career, firstAction = false) => tracker?.play(s, firstAction),
  firstSeason: (s: Career) => tracker?.firstSeason(s),
  retire: (s: Career) => tracker?.retire(s),
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
