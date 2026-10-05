// T-10-021 '홈 화면에 추가' 안내. 주소를 입력하지 않고 아이콘으로 바로 열 수 있게, 모바일 브라우저로 홈 화면에
// 다시 들어올 때마다 보여 준다('다시 보지 않기'를 체크하면 이 브라우저에서는 그만). 홈 화면 앱으로 연 경우와 데스크톱은
// 띄우지 않고, 설정 > 도움말에서는 언제든 다시 연다. T-11-092 휴대폰은 스토어 앱(T-11-095 App Store · Google Play)을 먼저 권한다.
import { hasKey, loadKey, saveKey } from '@offside/game/season';
import { closeSheet, showSheet } from './sheetState.svelte.js';
import { currentInApp, isStandalone, openExternal } from './inapp-open.js';
import { INSTALL_STEPS, detectPlatform, type Platform } from './install-platform.js';
import { appState } from './state.svelte.js';
import { APP_PROMO } from '@offside/app-core/appPromo';
import { openAppStore } from './appStore.js';

const HIDE_KEY = 'ft_install_hide';

export function showInstallGuide(withOptOut = false) {
  const platform = detectPlatform(navigator.userAgent, isStandalone());
  // T-10-115 앱 안 브라우저(카톡·인스타 등)에는 홈 화면 추가 메뉴가 없다 — 단계 대신 외부 브라우저로 여는 길을 보인다.
  if (platform === 'inapp') {
    showSheet(
      {
        kind: 'notice',
        eyebrow: 'Home screen',
        title: '홈 화면에 추가하고 앱처럼 열기',
        text: '외부 브라우저(Safari/Chrome)에서 열어야 홈 화면에 추가할 수 있어요.',
        muted: true,
      },
      [
        {
          label: '외부 브라우저로 열기',
          cls: 'btn-primary',
          fn: () => void openExternal(currentInApp()),
        },
        { label: '닫기', fn: closeSheet },
      ],
    );
    return;
  }
  // T-11-092 휴대폰은 스토어 앱을 먼저 권하고(T-11-095 Android는 Google Play), 원하면 홈 화면 추가 단계로 넘어간다.
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
        { label: '닫기', fn: closeSheet },
      ],
    );
    return;
  }
  homeScreenSteps(platform, withOptOut);
}

const optOutCheck = (withOptOut: boolean) =>
  withOptOut
    ? { check: { label: '다시 보지 않기', onChange: (on: boolean) => saveKey(HIDE_KEY, on) } }
    : {};

function homeScreenSteps(platform: Exclude<Platform, 'inapp'>, withOptOut: boolean) {
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'Home screen',
      title: '홈 화면에 추가하고 앱처럼 열기',
      steps: INSTALL_STEPS[platform],
      text: '홈 화면의 오프사이드 아이콘으로 바로 열어요. 이 안내는 설정 > 도움말에서 다시 볼 수 있어요.',
      muted: true,
      ...optOutCheck(withOptOut),
    },
    [{ label: '확인했어요', cls: 'btn-primary', fn: closeSheet }],
  );
}

/** 앱을 열었을 때 모바일 브라우저의 홈 화면이면 보여 준다('다시 보지 않기'를 체크했으면 그만).
 * T-10-037: 처음 온 방문(세이브 없음)에는 띄우지 않는다 — 첫 화면을 시트로 가리지 않고(늦게 뜬 시트 문단이
 * 첫 화면 LCP가 됐다), 한 번 플레이하고 다시 찾아온 사람에게 권한다. */
export function maybeShowInstallOnboarding() {
  if (
    appState.screen !== 'home' ||
    loadKey<boolean>(HIDE_KEY) ||
    isStandalone() ||
    ['other', 'inapp'].includes(detectPlatform(navigator.userAgent)) // T-10-115 앱 안 브라우저엔 띄우지 않는다(홈의 안내 배너가 대신한다)
  )
    return;
  if (!hasKey('ft_save')) return;
  showInstallGuide(true);
}
