// T-10-021 '홈 화면에 추가' 안내. 주소를 입력하지 않고 아이콘으로 바로 열 수 있게, 모바일 브라우저로 처음 온
// 사람에게 한 번 보여 주고(이미 홈 화면 앱으로 연 경우는 제외) 설정 > 도움말에서 언제든 다시 연다.
import { loadKey, saveKey } from '../game/season.js';
import { closeSheet, showSheet } from './sheetState.svelte.js';
import { INSTALL_STEPS, detectPlatform } from './install-platform.js';

const SEEN_KEY = 'ft_install_seen';

/** 홈 화면 아이콘(웹 앱)으로 연 상태인지. */
function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function showInstallGuide() {
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'Home screen',
      title: '홈 화면에 추가하고 앱처럼 열기',
      steps: INSTALL_STEPS[detectPlatform(navigator.userAgent)],
      text: '홈 화면에 생긴 오프사이드 아이콘을 누르면 주소를 입력하지 않고 바로 이어서 할 수 있어요. 이 안내는 설정 > 도움말에서 다시 볼 수 있어요.',
      muted: true,
    },
    [{ label: '확인했어요', cls: 'btn-primary', fn: closeSheet }],
  );
}

/** 모바일 브라우저로 처음 온 사람에게 한 번만 보여 준다. */
export function maybeShowInstallOnboarding() {
  if (loadKey<boolean>(SEEN_KEY) || isStandalone() || detectPlatform(navigator.userAgent) === 'other') return;
  saveKey(SEEN_KEY, true);
  showInstallGuide();
}
