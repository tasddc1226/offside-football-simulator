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

/** 푸시 열기에 붙이는 캠페인과 단계 허용 목록. 서버 push data의 campaign · reminderStage와 같다. */
const PUSH_CAMPAIGNS = new Map<unknown, readonly number[]>([
  ['career_reminder', [1, 2, 3]],
  ['retention_lapsed', [3, 7, 14, 30]], // 쉰 날 수(T-11-501)
  ['retention_onboarding', [1, 2, 3, 4, 5]], // 다음 할 일 순서
]);

/**
 * T-11-509 알림 권유를 띄운 곳. 홈 카드 · 친구 화면 · 은퇴 리포트 · 판매 등록 뒤 · 구단 만든 뒤.
 * T-11-586 리그 신청 뒤 · 컵 접수 뒤, quiet는 창 없이 받은 iOS 조용한 알림(결과만 보낸다).
 */
export const PUSH_ASK_PLACES = [
  'home',
  'friends',
  'retire',
  'sell',
  'club',
  'league',
  'cup',
  'quiet',
] as const;
export type PushAskPlace = (typeof PUSH_ASK_PLACES)[number];
/** OS 권한 요청 결과. failed는 권한은 받았지만 기기 등록이 실패한 경우다. */
export type PushAskResult = 'granted' | 'denied' | 'blocked' | 'failed';

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
  const pushSeen = new Set<string>();
  const askSeen = new Set<PushAskPlace>();
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
    /** OS response only; IDs are local dedupe keys and never enter SDK parameters. */
    async pushOpen(id: string, kind: unknown, campaign: unknown, stage: unknown) {
      if (!io.enabled() || consent !== 'granted' || screen === 'admin') return false;
      const epoch = generation;
      await pending; // A consented cold start may still be initializing the native SDK.
      if (epoch !== generation || !allowed() || screen === 'admin' || pushSeen.has(id))
        return false;
      pushSeen.add(id);
      if (pushSeen.size > 50) pushSeen.delete(pushSeen.values().next().value!);
      const category =
        typeof kind === 'string' &&
        ['news', 'team', 'market', 'social', 'community', 'return', 'test'].includes(kind)
          ? kind
          : 'other';
      const tagged =
        typeof stage === 'number' && PUSH_CAMPAIGNS.get(campaign)?.includes(stage) === true;
      send('offside_push_open', {
        push_category: category,
        ...(tagged ? { push_campaign: campaign as string, reminder_stage: stage } : {}),
      });
      return true;
    },
    /** T-11-423 제휴 홈 팝업(웹 partner_popup_*과 같은 이름). 소재 a·b만 보낸다. */
    partnerPopup(action: 'view' | 'click' | 'close' | 'hide_today', variant: 'a' | 'b') {
      send('partner_popup_' + action, { partner: 'amachuggu', variant });
    },
    /** T-11-509 알림 권유 단계(보임 · 받기 · 나중에 · OS 결과). 보임은 실행마다 곳별로 한 번만 보낸다. */
    pushAsk(
      action: 'view' | 'accept' | 'later' | 'result',
      place: PushAskPlace,
      result?: PushAskResult,
    ) {
      if (!PUSH_ASK_PLACES.includes(place)) return;
      if (action === 'view') {
        if (!allowed() || askSeen.has(place)) return;
        askSeen.add(place);
      }
      send('push_optin_' + action, { place, ...(action === 'result' && result ? { result } : {}) });
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
