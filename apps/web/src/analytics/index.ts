import { configureMeasurement, type OperationResult } from '@offside/app-core/measurement';
import type { Progress } from '@offside/app-core/player-metrics';
import { enabled } from './config.js';
import type { Career } from '@offside/app-core/analytics-model';
import type { AppStoreOs } from '@offside/app-core/appPromo';
import { onClubSignal, setClubAccountKey } from '@offside/app-core/clubSignals';
import type { AccountKey } from '@offside/app-core/retireExpMetrics';
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
      attachRetireExp(m);
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

/** T-11-669 은퇴 화면 실험 계측. 노출은 이용 분석이 준비될 때까지 보류하고(어댑터 · 동의 · 태그), 노출이 나가기 전의
 * 장면 · 다음 행동 클릭은 보내지 않는다(되돌려 보내지 않음). 계정 키는 원래 ID가 아니라 profileKey다. */
type RetireExpApi = typeof import('./browser.js').retireExp;
let retireView: Parameters<RetireExpApi['view']>[0] | null = null;
// 계정 상태는 ui/account-state가 불러와질 때 여기에 건다(첫 화면 번들에 계정 화면 코드 · 문구를 싣지 않게 의존 방향을 뒤집었다).
let accountSource: (() => AccountKey) | null = null;
const accountKeyNow = (): AccountKey => (accountSource ? accountSource() : undefined);
export function setRetireAccountSource(fn: () => AccountKey) {
  accountSource = fn;
}
/** account-state가 계정 확인 결과가 바뀔 때 부른다. 다른 계정이면 이전 노출 귀속을 지운다. */
export const noteRetireAccount = () => adapter?.retireExp.account(accountKeyNow());
let accountAsked = false;
/** 귀속 기록이 남아 있는데 계정을 아직 모를 때 한 번만(5분 메모 계정 확인) 묻는다. */
function needRetireAccount() {
  if (accountAsked) return;
  accountAsked = true;
  void import('../ui/account-state.svelte.js').then((m) => m.ensureAccount()).catch(() => {});
}
setClubAccountKey(accountKeyNow);
function attachRetireExp(m: typeof import('./browser.js')) {
  m.setRetireAccountKey(accountKeyNow, needRetireAccount);
  if (retireView) m.retireExp.view(retireView);
}
export const retireExp = {
  view: (x: Parameters<RetireExpApi['view']>[0]) => {
    retireView = x;
    adapter?.retireExp.view(x);
  },
  leave: (...a: Parameters<RetireExpApi['leave']>) => {
    retireView = null;
    adapter?.retireExp.leave(...a);
  },
  end: () => {
    retireView = null;
    adapter?.retireExp.end();
  },
  scene: (...a: Parameters<RetireExpApi['scene']>) => adapter?.retireExp.scene(...a),
  cta: (...a: Parameters<RetireExpApi['cta']>) => adapter?.retireExp.cta(...a),
  error: (...a: Parameters<RetireExpApi['error']>) => adapter?.retireExp.error(...a),
};
// 서버가 팀 저장 · 구단 경기 결과를 돌려준 순간(api/team). 요청 당시 계정 키와 함께 넘긴다.
onClubSignal((sig, requestKey) => adapter?.retireExp.club(sig, requestKey));
