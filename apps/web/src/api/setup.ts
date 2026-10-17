// 공용 API 클라이언트·업로드 큐(@offside/app-core, T-11-002)에 웹 서버 주소와 세션 쿠키 인증을 넣는다.
// main.ts가 맨 먼저 불러 첫 요청 전에 설정되게 한다.
import { configureApi } from '@offside/app-core/api/client';
import { resolveApiBaseUrl } from './base-url.js';

configureApi({
  baseUrl: resolveApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL as string | undefined,
    typeof window === 'undefined' ? undefined : window.location.hostname,
  ),
  auth: () => ({ credentials: 'include' }),
});

declare const __APP_VERSION__: string | undefined;

// T-11-331 잡히지 않은 오류를 서버로 모은다(운영 빌드, 로컬 미리보기 · e2e 제외). 보내는 코드는 첫 오류가 났을 때만
// 불러온다(첫 화면 번들 예산).
const local = typeof window === 'undefined' || /^(localhost|127\.|\[::1\])/.test(location.hostname);
if (import.meta.env.PROD && !local) {
  let reporter: Promise<typeof import('@offside/app-core/errorReport')> | null = null;
  const load = () =>
    (reporter ??= import('@offside/app-core/errorReport').then((m) => {
      m.configureErrorReport({
        platform: 'web',
        version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
      });
      return m;
    }));
  const report = (kind: 'error' | 'rejection', error: unknown) => {
    const where = location.pathname.slice(0, 120);
    void load()
      .then((m) => m.reportError(kind, error, where))
      .catch(() => {});
  };
  window.addEventListener('error', (e) => report('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => report('rejection', e.reason));
  window.addEventListener('pagehide', () => void reporter?.then((m) => m.flushErrors()));
}
