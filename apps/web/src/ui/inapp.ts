// T-10-115 인앱 브라우저(카톡·인스타·스레드·페북·네이버·라인 웹뷰) 감지 — 순수 함수만 둔다(테스트 가능).
// 구글은 웹뷰의 OAuth를 막고(403 disallowed_useragent), 웹뷰는 localStorage도 실제 브라우저와 따로라서
// 로그인·홈 화면 추가·기록 이어하기가 모두 외부 브라우저에서 해야 안전하다.
export type InAppName =
  'kakao' | 'instagram' | 'threads' | 'facebook' | 'naver' | 'line' | 'other-webview';
export type InAppOs = 'ios' | 'android' | 'other';
export type InAppInfo = { app: InAppName; os: InAppOs };

export function osOf(ua: string): InAppOs {
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/**
 * UA로 인앱 브라우저를 알아본다. 아니면 null.
 * standalone(홈 화면 아이콘으로 연 웹 앱)이면 iOS의 'Safari 토큰 없음' 추정을 건너뛴다 — 홈 화면 앱의 UA도
 * Safari 토큰이 없어서 웹뷰로 오인되기 쉽다. 이름이 박힌 앱(카톡 등)은 항상 잡는다.
 */
export function detectInApp(ua: string, standalone = false): InAppInfo | null {
  const os = osOf(ua);
  // 스레드는 UA에 코드명 'Barcelona'가 박히고 인스타 토큰도 함께 있을 수 있어 인스타보다 먼저 본다.
  const app: InAppName | null = /KAKAOTALK/i.test(ua)
    ? 'kakao'
    : /Barcelona[ /]\d|Threads/.test(ua)
      ? 'threads'
      : /Instagram/i.test(ua)
        ? 'instagram'
        : /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/.test(ua)
          ? 'facebook'
          : /NAVER\(inapp/i.test(ua)
            ? 'naver'
            : /\bLine\/\d/i.test(ua)
              ? 'line'
              : null;
  if (app) return { app, os };
  // 이름 없는 웹뷰: 안드로이드 WebView는 UA에 '; wv)', iOS WKWebView(앱 안)는 Safari 토큰이 없다.
  if (os === 'android' && /; wv\)/.test(ua)) return { app: 'other-webview', os };
  if (os === 'ios' && !standalone && !/Safari\//.test(ua)) return { app: 'other-webview', os };
  return null;
}

/**
 * 인앱 브라우저에서 외부 브라우저로 열 URL. 프로그램으로 열 수 없으면(iOS의 인스타·페북 등) null —
 * 그땐 주소를 복사하고 사용자에게 메뉴 안내를 보인다.
 * - 카카오톡(두 OS): kakaotalk://web/openExternal?url=…
 * - 안드로이드: intent://…#Intent;scheme=https;package=com.android.chrome;end (해시는 intent 구분자와 겹쳐 뺀다)
 */
export function externalOpenUrl(info: InAppInfo, href: string): string | null {
  if (info.app === 'kakao') return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  if (info.os === 'android') {
    const u = new URL(href);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  return null;
}

/** 프로그램으로 못 여는 경우의 안내 문구. 앱마다 메뉴 위치가 달라 위치는 뭉뚱그리고 항목 이름만 짚는다. */
export function manualOpenGuide(info: InAppInfo, copied: boolean): string {
  const menu =
    info.os === 'ios'
      ? "화면의 ··· (또는 공유) 메뉴에서 'Safari로 열기'를 눌러 주세요."
      : "화면의 ··· (또는 ⋮) 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.";
  return copied ? `${menu} 주소를 복사해 뒀으니 브라우저 주소창에 붙여 넣어도 돼요.` : menu;
}
