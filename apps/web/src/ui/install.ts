// 설정에서 직접 여는 홈 화면 추가 안내. 자동 설치 팝업 대신 홈의 제한된 카드 안내를 사용한다.
// T-11-092 휴대폰은 스토어 앱(T-11-449 App Store · Google Play)을 먼저 권한다.
import { saveKey } from '@offside/game/storage';
import { closeSheet, showSheet } from './sheetState.svelte.js';
import { currentInApp, isStandalone, openExternal } from './inapp-open.js';
import { INSTALL_STEPS, detectPlatform, type Platform } from './install-platform.js';
import { APP_PROMO } from '@offside/app-core/appPromo';
import { openAppStore } from './appStore.js';
import { shellInstallText as L } from '@offside/app-core/i18n/ko/shellInstall';
import { shellInstallGuideText } from '@offside/app-core/i18n/ko/shellInstallGuide';

const HIDE_KEY = 'ft_install_hide';

export function showInstallGuide(withOptOut = false) {
  const platform = detectPlatform(navigator.userAgent, isStandalone());
  // T-10-115 앱 안 브라우저(카톡·인스타 등)에는 홈 화면 추가 메뉴가 없다 — 단계 대신 외부 브라우저로 여는 길을 보인다.
  if (platform === 'inapp') {
    showSheet(
      {
        kind: 'notice',
        eyebrow: 'Home screen',
        title: shellInstallGuideText.installTitle,
        text: shellInstallGuideText.installInapp,
        muted: true,
      },
      [
        {
          label: L.inappOpen,
          cls: 'btn-primary',
          fn: () => void openExternal(currentInApp()),
        },
        { label: L.close, fn: closeSheet },
      ],
    );
    return;
  }
  // T-11-092 휴대폰은 스토어 앱을 먼저 권하고(T-11-449 Android는 Google Play), 원하면 홈 화면 추가 단계로 넘어간다.
  const os = platform.startsWith('ios') ? 'ios' : platform === 'android' ? 'android' : null;
  if (os) {
    showSheet(
      {
        kind: 'notice',
        eyebrow: APP_PROMO.sheet.eyebrow(os),
        title: APP_PROMO.sheet.title(os),
        text: APP_PROMO.sheet.text,
        muted: true,
        ...optOutCheck(withOptOut),
      },
      [
        {
          label: APP_PROMO.getApp(os),
          cls: 'btn-primary',
          fn: () => {
            closeSheet();
            openAppStore(os, 'sheet');
          },
        },
        // 다시 보지 않기는 앞 시트에서 이미 물었다.
        { label: APP_PROMO.sheet.homeScreen, fn: () => homeScreenSteps(platform, false) },
        { label: L.close, fn: closeSheet },
      ],
    );
    return;
  }
  homeScreenSteps(platform, withOptOut);
}

const optOutCheck = (withOptOut: boolean) =>
  withOptOut
    ? {
        check: {
          label: shellInstallGuideText.optOut,
          onChange: (on: boolean) => saveKey(HIDE_KEY, on),
        },
      }
    : {};

function homeScreenSteps(platform: Exclude<Platform, 'inapp'>, withOptOut: boolean) {
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'Home screen',
      title: shellInstallGuideText.installTitle,
      steps: INSTALL_STEPS[platform],
      text: shellInstallGuideText.installBody,
      muted: true,
      ...optOutCheck(withOptOut),
    },
    [{ label: L.gotIt, cls: 'btn-primary', fn: closeSheet }],
  );
}
