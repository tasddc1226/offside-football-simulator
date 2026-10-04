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
