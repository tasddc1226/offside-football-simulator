import { enabled } from './config.js';
import type { Career } from '@offside/app-core/analytics-model';
export { enabled } from './config.js';
let adapter: typeof import('./browser.js') | undefined;
let screen = 'home';
let initializing = false;
// Optional analytics never blocks mounting, game actions or save recovery. No action replay.
export function initializeAnalytics(initialScreen: string, restoredCareerId: string | null = null) {
  screen = initialScreen;
  if (initializing || !enabled()) return;
  initializing = true;
  void import('./browser.js')
    .then((m) => {
      adapter = m;
      m.initializeAnalytics(screen, restoredCareerId);
    })
    .catch(() => {});
}
export function trackPage(next: string) {
  screen = next;
  adapter?.trackPage(next);
}
export const analytics = {
  replace: () => adapter?.analytics.replace(),
  start: (s: Career, previous: Career | null) => adapter?.analytics.start(s, previous),
  play: (s: Career, firstAction = false) => adapter?.analytics.play(s, firstAction),
  firstSeason: (s: Career) => adapter?.analytics.firstSeason(s),
  retire: (s: Career) => adapter?.analytics.retire(s),
};
export const trackShareClick = () => adapter?.trackShareClick();
export const trackShareSuccess = () => adapter?.trackShareSuccess();
