import { configureMeasurement, type OperationResult } from '@offside/app-core/measurement';
import type { Progress } from '@offside/app-core/player-metrics';
import { enabled } from './config.js';
import type { Career } from './model.js';
export { enabled } from './config.js';
let adapter: typeof import('./browser.js') | undefined;
let screen = 'home';
let initializing = false;
const pending: OperationResult[] = [];
configureMeasurement((result) => {
  if (adapter) return adapter.trackOperation(result);
  try {
    if (
      enabled() &&
      localStorage.getItem('offside_analytics_consent_v1') === 'granted' &&
      pending.length < 20
    )
      pending.push(result);
  } catch {
    /* storage denied */
  }
});
// Optional analytics never blocks mounting, game actions or save recovery. No action replay.
export function initializeAnalytics(initialScreen: string, restoredCareerId: string | null = null) {
  screen = initialScreen;
  if (initializing || !enabled()) return;
  initializing = true;
  void import('./browser.js')
    .then((m) => {
      adapter = m;
      m.initializeAnalytics(screen, restoredCareerId);
      for (const result of pending.splice(0)) m.trackOperation(result);
    })
    .catch(() => {});
}
export function trackPage(next: string) {
  screen = next;
  adapter?.trackPage(next);
}
export const analytics = {
  complete: (p: Progress) => adapter?.analytics.complete(p),
  replace: () => adapter?.analytics.replace(),
  start: (s: Career, previous: Career | null) => adapter?.analytics.start(s, previous),
  play: (s: Career, firstAction = false) => adapter?.analytics.play(s, firstAction),
  firstSeason: (s: Career) => adapter?.analytics.firstSeason(s),
  retire: (s: Career) => adapter?.analytics.retire(s),
};
export const trackShareClick = () => adapter?.trackShareClick();
export const trackShareSuccess = () => adapter?.trackShareSuccess();
