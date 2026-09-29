// 업로드 큐(웹·앱 공용 @offside/app-core/outbox, T-11-002)에 웹 전송 설정을 넣는다 — 세션 쿠키로 보내고,
// 소유권 충돌·영구결번 결과는 window 이벤트로 알린다(syncEvents.ts). helpers.ts 등이 동적 import로만 불러
// 메인 청크와 분리한다.
import {
  configureOutbox,
  type OutboxItem,
  type RetiredNumberEvent,
} from '@offside/app-core/outbox';
import { resolveApiBaseUrl } from '../api/base-url.js';
import { clearApiCache, noteSession } from '../api/client.js';
import { OWNER_CONFLICT_EVENT, RETIRED_NUMBER_EVENT } from './syncEvents.js';

export * from '@offside/app-core/outbox';

const emit = <T>(type: string, detail: T) =>
  globalThis.dispatchEvent?.(new CustomEvent(type, { detail }));

configureOutbox({
  baseUrl: () =>
    resolveApiBaseUrl(
      import.meta.env.VITE_API_BASE_URL as string | undefined,
      typeof window === 'undefined' ? undefined : window.location.hostname,
    ),
  auth: () => ({ credentials: 'include' }),
  onSession: () => noteSession(true),
  onRetirementSent: clearApiCache,
  onConflict: (items) => emit<OutboxItem[]>(OWNER_CONFLICT_EVENT, items),
  onRetiredNumber: (ev) => emit<RetiredNumberEvent>(RETIRED_NUMBER_EVENT, ev),
});
