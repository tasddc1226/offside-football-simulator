// T-10-021 '홈 화면에 추가' 안내. 주소를 입력하지 않고 아이콘으로 바로 열 수 있게, 모바일 브라우저로 홈 화면에
// 다시 들어올 때마다 보여 준다('다시 보지 않기'를 체크하면 이 브라우저에서는 그만). 홈 화면 앱으로 연 경우와 데스크톱은
// 띄우지 않고, 설정 > 도움말에서는 언제든 다시 연다.
import { hasKey, loadKey, saveKey } from '../game/season.js';
import { closeSheet, showSheet } from './sheetState.svelte.js';
import { INSTALL_STEPS, detectPlatform } from './install-platform.js';
import { appState } from './state.svelte.js';

const HIDE_KEY = 'ft_install_hide';

/** 홈 화면 아이콘(웹 앱)으로 연 상태인지. */
function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function showInstallGuide(withOptOut = false) {
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'Home screen',
      title: '홈 화면에 추가하고 앱처럼 열기',
      steps: INSTALL_STEPS[detectPlatform(navigator.userAgent)],
      text: '홈 화면에 생긴 오프사이드 아이콘을 누르면 주소를 입력하지 않고 바로 이어서 할 수 있어요. 이 안내는 설정 > 도움말에서 다시 볼 수 있어요.',
      muted: true,
      ...(withOptOut ? { check: { label: '다시 보지 않기', onChange: (on: boolean) => saveKey(HIDE_KEY, on) } } : {}),
    },
    [{ label: '확인했어요', cls: 'btn-primary', fn: closeSheet }],
  );
}

/** 앱을 열었을 때 모바일 브라우저의 홈 화면이면 보여 준다('다시 보지 않기'를 체크했으면 그만).
 * T-10-037: 처음 온 방문(세이브 없음)에는 띄우지 않는다 — 첫 화면을 시트로 가리지 않고(늦게 뜬 시트 문단이
 * 첫 화면 LCP가 됐다), 한 번 플레이하고 다시 찾아온 사람에게 권한다. */
export function maybeShowInstallOnboarding() {
  if (appState.screen !== 'home' || loadKey<boolean>(HIDE_KEY) || isStandalone() || detectPlatform(navigator.userAgent) === 'other') return;
  if (!hasKey('ft_save')) return;
  showInstallGuide(true);
}
