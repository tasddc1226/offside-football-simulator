import { detectInApp } from './inapp.js';
import { shellInstallGuideText } from '@offside/app-core/i18n/ko/shellInstallGuide';
// T-10-021 '홈 화면에 추가' 안내의 브라우저별 단계. 화면(install.ts)과 떼어 단위 테스트할 수 있게 둔다.
// T-10-115 'inapp'은 카톡·인스타 같은 앱 안 브라우저 — 홈 화면 추가 메뉴가 없어 단계 대신 외부 브라우저 안내를 보인다.
export type Platform = 'ios-chrome' | 'ios-safari' | 'android' | 'other' | 'inapp';

// 단계 문구는 읽을 때마다 지금 언어로 고른다(getter) — 모듈을 불러올 때 굳히지 않는다.
export const INSTALL_STEPS: Record<Exclude<Platform, 'inapp'>, string[]> = {
  get 'ios-chrome'() {
    return [
      shellInstallGuideText.stepIosChrome1,
      shellInstallGuideText.stepIosChrome2,
      shellInstallGuideText.stepIosChrome3,
      shellInstallGuideText.stepIosChrome4,
    ];
  },
  get 'ios-safari'() {
    return [
      shellInstallGuideText.stepIosSafari1,
      shellInstallGuideText.stepIosSafari2,
      shellInstallGuideText.stepIosSafari3,
    ];
  },
  get android() {
    return [
      shellInstallGuideText.stepAndroid1,
      shellInstallGuideText.stepAndroid2,
      shellInstallGuideText.stepAndroid3,
    ];
  },
  get other() {
    return [
      shellInstallGuideText.stepOther1,
      shellInstallGuideText.stepOther2,
      shellInstallGuideText.stepOther3,
    ];
  },
};

export function detectPlatform(ua: string, standalone = false): Platform {
  if (detectInApp(ua, standalone)) return 'inapp';
  if (/iPhone|iPad|iPod/.test(ua)) return /CriOS/.test(ua) ? 'ios-chrome' : 'ios-safari';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
