// T-10-115 인앱 브라우저 안내의 화면 쪽 — 지금 브라우저가 인앱인지 보고, 외부 브라우저로 열거나 방법을 안내한다.
// 판별·URL 조립은 inapp.ts(순수)에 있다.
import { detectInApp, externalOpenUrl, manualOpenGuide, type InAppInfo } from './inapp.js';
import { closeSheet, showSheet } from './sheetState.svelte.js';

/** 홈 화면 아이콘(웹 앱)으로 연 상태인지. */
export function isStandalone(): boolean {
  try {
    return (
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

let cached: InAppInfo | null | undefined;
/** 지금 열린 브라우저가 인앱 브라우저면 그 정보, 아니면 null(한 번 계산해 둔다). */
export function currentInApp(): InAppInfo | null {
  if (cached === undefined) cached = detectInApp(navigator.userAgent, isStandalone());
  return cached;
}

/** 글을 클립보드에 복사한다. 성공 여부를 돌려준다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 인앱 웹뷰는 clipboard API가 막힌 경우가 많다 — execCommand로 한 번 더 시도한다.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * 외부 브라우저로 연다. 스킴으로 열 수 있으면(카톡·안드로이드) 그대로 넘기고, 아니면(iOS 인스타·페북 등)
 * 주소를 복사한 뒤 메뉴 안내 시트를 띄운다.
 */
export async function openExternal(info: InAppInfo | null = currentInApp()) {
  if (!info) return;
  const href = window.location.href;
  const url = externalOpenUrl(info, href);
  if (url) {
    closeSheet();
    window.location.href = url;
    return;
  }
  const copied = await copyText(href);
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'External browser',
      title: '외부 브라우저에서 열어 주세요',
      text: manualOpenGuide(info, copied),
    },
    [{ label: '확인했어요', cls: 'btn-primary', fn: closeSheet }],
  );
}

/** 인앱 브라우저에서 구글 로그인을 누른 사람에게 — 구글이 웹뷰 로그인을 막는다고 알리고 외부 브라우저로 안내한다. */
export function showInAppLoginNotice(info: InAppInfo) {
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'Google login',
      title: '외부 브라우저에서 로그인해 주세요',
      text: '구글이 앱 안 브라우저(카톡·인스타 등)에서의 로그인을 막고 있어요. 외부 브라우저로 열어서 로그인해 주세요.',
      muted: true,
    },
    [
      { label: '외부 브라우저로 열기', cls: 'btn-primary', fn: () => void openExternal(info) },
      { label: '닫기', fn: closeSheet },
    ],
  );
}
