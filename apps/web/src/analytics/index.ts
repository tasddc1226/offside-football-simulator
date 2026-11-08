import { configureMeasurement, type OperationResult } from '@offside/app-core/measurement';
import type { Progress } from '@offside/app-core/player-metrics';
import { enabled } from './config.js';
import type { Career } from '@offside/app-core/analytics-model';
import type { AppStoreOs } from '@offside/app-core/appPromo';
import type { ShareOutcome } from '@offside/app-core/shareMeasurement';
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
/** T-11-668 커리어 링크 공유 시도와 결과(의미는 @offside/app-core/shareMeasurement). */
export const trackShare = (o: ShareOutcome) => adapter?.trackShare(o);
/** T-11-092 앱 스토어 링크를 누른 곳(T-11-449 어느 스토어인지도 남긴다). */
export type AppStorePlace = 'home' | 'home_top' | 'retire' | 'sheet' | 'settings' | 'shop';
export const trackAppStoreClick = (place: AppStorePlace, store: AppStoreOs) =>
  adapter?.trackAppStoreClick(place, store);

/** T-11-506 home_top: 휴대폰 웹 홈 맨 위 한 줄 띠. T-11-611 retire: 은퇴 리포트 끝. */
export type AppConversionPlace = 'home' | 'home_top' | 'shop' | 'retire';
export const trackAppConversion = (
  action: 'view' | 'click' | 'dismiss',
  place: AppConversionPlace,
  target: 'ios' | 'android' | 'both',
) => adapter?.trackAppConversion(action, place, target);

/** T-11-423 제휴 홈 팝업. 노출 · 이동 · 닫기(오늘 하루 숨김 포함)와 소재(a·b)를 남긴다. */
export type PartnerPopupAction = 'view' | 'click' | 'close' | 'hide_today';
export const trackPartnerPopup = (action: PartnerPopupAction, variant: 'a' | 'b') =>
  adapter?.trackPartnerPopup(action, variant);
