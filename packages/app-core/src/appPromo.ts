// T-11-092 웹에서 앱으로 이어 주는 안내 문구(웹 전용 화면이 쓴다). T-11-095 Android 정식 출시로 iPhone은 App Store,
// Android는 Google Play로 보낸다. 앱이 웹보다 실제로 나은 점만 쓴다: 브라우저 정리로 기록이 지워지지 않고, 새 소식을 알림으로 받는다.
// 진행 중인 커리어는 저절로 옮겨지지 않으니(세이브는 기기 저장) 백업 코드로 옮기는 길을 함께 알린다.
// 문구는 읽을 때마다 지금 언어로 고른다 — 모듈을 불러올 때 굳히지 않는다.
import { shellInstallText as L } from './i18n/ko/shellInstall.js';
import { IOS_APP_STORE_URL, PLAY_STORE_URL } from './links.js';

export type AppStoreOs = 'ios' | 'android';
export const APP_STORES: Record<AppStoreOs, { device: string; store: string; url: string }> = {
  ios: { device: 'iPhone', store: 'App Store', url: IOS_APP_STORE_URL },
  android: { device: 'Android', store: 'Google Play', url: PLAY_STORE_URL },
};

export const APP_PROMO = {
  tile: (os: AppStoreOs) => ({
    eyebrow: APP_STORES[os].device,
    title: L.promoTileTitle(APP_STORES[os]),
    sub: L.promoTileSub(APP_STORES[os]),
  }),
  sheet: {
    eyebrow: (os: AppStoreOs) => `${APP_STORES[os].device} app`,
    title: (os: AppStoreOs) => L.promoSheetTitle(APP_STORES[os]),
    get text() {
      return L.promoSheetText;
    },
    get homeScreen() {
      return L.promoSheetHomeScreen;
    },
  },
  getApp: (os: AppStoreOs) => L.promoSheetStore(APP_STORES[os]),
  /** 설정 > 앱으로 옮기기. 기기를 모르면(PC) 두 스토어를 함께 보인다. */
  move: (oses: readonly AppStoreOs[]) => ({
    title: oses.length === 1 ? L.promoMoveTitle(APP_STORES[oses[0]!]) : L.promoMoveTitleAny,
    steps: [
      L.promoMoveStep1({ stores: oses.map((os) => APP_STORES[os].store) }),
      L.promoMoveStep2,
      L.promoMoveStep3,
    ],
  }),
};
