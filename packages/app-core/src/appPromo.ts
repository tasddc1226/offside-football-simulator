// T-11-092 웹에서 앱으로 이어 주는 안내 문구(웹 전용 화면이 쓴다). iOS는 App Store로 보내고, 안드로이드는 비공개 테스트라
// 지금처럼 테스터 모집으로 둔다. 앱이 웹보다 실제로 나은 점만 쓴다: 브라우저 정리로 기록이 지워지지 않고, 새 소식을 알림으로 받는다.
// 진행 중인 커리어는 저절로 옮겨지지 않으니(세이브는 기기 저장) 백업 코드로 옮기는 길을 함께 알린다.
// 문구는 읽을 때마다 지금 언어로 고른다(getter) — 모듈을 불러올 때 굳히지 않는다.
import { shellInstallText as L } from './i18n/ko/shellInstall.js';

export const APP_PROMO = {
  tile: {
    eyebrow: 'iPhone',
    get title() {
      return L.promoTileTitle;
    },
    get sub() {
      return L.promoTileSub;
    },
  },
  sheet: {
    eyebrow: 'iPhone app',
    get title() {
      return L.promoSheetTitle;
    },
    get text() {
      return L.promoSheetText;
    },
    get store() {
      return L.promoSheetStore;
    },
    get homeScreen() {
      return L.promoSheetHomeScreen;
    },
  },
  move: {
    get title() {
      return L.promoMoveTitle;
    },
    get steps(): readonly string[] {
      return [L.promoMoveStep1, L.promoMoveStep2, L.promoMoveStep3];
    },
  },
} as const;
