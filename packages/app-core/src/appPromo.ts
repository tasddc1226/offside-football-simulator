// T-11-092 웹에서 앱으로 이어 주는 안내 문구(웹 전용 화면이 쓴다). T-11-095 Android 정식 출시로 iPhone은 App Store,
// Android는 Google Play로 보낸다. 앱이 웹보다 실제로 나은 점만 쓴다: 브라우저 정리로 기록이 지워지지 않고, 새 소식을 알림으로 받는다.
// 진행 중인 커리어는 저절로 옮겨지지 않으니(세이브는 기기 저장) 백업 코드로 옮기는 길을 함께 알린다.
import { IOS_APP_STORE_URL, PLAY_STORE_URL } from './links.js';

export type AppStoreOs = 'ios' | 'android';
export const APP_STORES: Record<AppStoreOs, { device: string; store: string; url: string }> = {
  ios: { device: 'iPhone', store: 'App Store', url: IOS_APP_STORE_URL },
  android: { device: 'Android', store: 'Google Play', url: PLAY_STORE_URL },
};

export const APP_PROMO = {
  tile: (os: AppStoreOs) => ({
    eyebrow: APP_STORES[os].device,
    title: `${APP_STORES[os].device} 앱 ↗`,
    sub: `${APP_STORES[os].store}에서 오프사이드 받기`,
  }),
  sheet: {
    eyebrow: (os: AppStoreOs) => `${APP_STORES[os].device} app`,
    title: (os: AppStoreOs) => `${APP_STORES[os].device} 앱으로 이어서 해요`,
    text: '앱은 오래 안 들어와도 기록이 지워지지 않고, 새 소식을 알림으로 받아요. 진행 중인 커리어는 설정의 백업 코드로 앱에 옮겨요.',
    homeScreen: '홈 화면에 추가할게요',
  },
  getApp: (os: AppStoreOs) => `${APP_STORES[os].store}에서 받기`,
  /** 설정 > 앱으로 옮기기. 기기를 모르면(PC) 두 스토어를 함께 보인다. */
  move: (oses: readonly AppStoreOs[]) => ({
    title: oses.length === 1 ? `${APP_STORES[oses[0]!].device} 앱으로 옮기기` : '앱으로 옮기기',
    steps: [
      `${oses.map((os) => APP_STORES[os].store).join('나 ')}에서 오프사이드를 받아요.`,
      '앱의 구단주 화면에서 같은 구글 계정으로 로그인하면 명예의 전당 · 구단 기록이 이어져요.',
      '진행 중인 커리어는 아래 백업 코드를 복사해 앱 설정의 백업에 붙여 넣어요.',
    ],
  }),
};
