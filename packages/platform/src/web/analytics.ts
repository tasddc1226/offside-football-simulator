import { ANALYTICS_EVENT_NAMES, ANALYTICS_EVENTS_MAX_COUNT } from '@offside/contracts';
import type { LocalStore } from '@offside/engine-client';
import type { Platform } from '../types.js';
import { createDexieLocalStore } from './dexie-store.js';

const CLIENT_ID_KV_KEY = 'analytics:clientId';
const FLUSH_QUEUE_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;

type QueuedEvent = { name: string; props?: Record<string, string | number | boolean>; clientTs: number };

let clientIdStorePromise: Promise<LocalStore> | undefined;

function getClientIdStore(): Promise<LocalStore> {
  clientIdStorePromise ??= createDexieLocalStore();
  return clientIdStorePromise;
}

/**
 * "이 기기 데이터 삭제"가 `Dexie.delete()`를 부르기 전에 이 store의 연결을 닫아야 한다 — 열린
 * 연결이 남아 있으면 삭제가 대기한다(dexie-store.ts의 `deleteDexieLocalStore` 주석과 같은 이유).
 */
export async function closeAnalyticsClientIdStore(): Promise<void> {
  if (!clientIdStorePromise) return;
  const pending = clientIdStorePromise;
  clientIdStorePromise = undefined;
  await (await pending).close();
}

async function getOrCreateClientId(): Promise<string> {
  const store = await getClientIdStore();
  return store.transaction('readwrite', async (tx) => {
    const existing = await tx.kv.get<string>(CLIENT_ID_KV_KEY);
    if (existing !== undefined) return existing;
    const id = crypto.randomUUID();
    await tx.kv.put(CLIENT_ID_KV_KEY, id);
    return id;
  });
}

const WHITELISTED_NAMES: readonly string[] = ANALYTICS_EVENT_NAMES;

/**
 * web 채널 analytics 어댑터. 메모리 큐 → (20건 | 10초 | pagehide/visibilitychange:hidden)에
 * `sendBeacon` 우선, 없으면 `fetch(keepalive)`로 전송한다. 재시도는 없다(01 최종 일관성 허용).
 * `getClientId`는 테스트가 실제 Dexie 연결 없이 큐·전송 동작만 확인할 수 있도록 주입 지점을 둔다.
 */
export function createAnalytics(
  analyticsEndpoint: string,
  options: { dev?: boolean; getClientId?: () => Promise<string> } = {},
): Platform['analytics'] {
  const dev = options.dev ?? false;
  const getClientId = options.getClientId ?? getOrCreateClientId;

  const queue: QueuedEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let cachedClientId: string | undefined;
  // 첫 track() 호출 전까지는 clientId를 건드리지 않는다 — createWebPlatform()은 앱 시작 시 모듈
  // 스코프에서 바로 만들어지므로, 여기서 즉시 실행하면 track을 한 번도 안 부른 환경(jsdom 등
  // IndexedDB가 없는 테스트)에서도 처리되지 않는 rejection이 뜬다.
  let clientIdReady: Promise<string> | undefined;

  function ensureClientIdReady(): Promise<string> {
    clientIdReady ??= getClientId().then((id) => {
      cachedClientId = id;
      return id;
    });
    return clientIdReady;
  }

  function clearTimer(): void {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
  }

  function send(clientId: string, events: QueuedEvent[]): void {
    const body = JSON.stringify({ clientId, events });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(analyticsEndpoint, new Blob([body], { type: 'application/json' }));
      if (sent) return;
    }
    void fetch(analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {
      // 재시도 없음 — 유실 허용(01 최종 일관성 허용).
    });
  }

  function flush(): void {
    clearTimer();
    if (queue.length === 0) return;
    const batch = queue.splice(0, ANALYTICS_EVENTS_MAX_COUNT);
    if (cachedClientId !== undefined) {
      send(cachedClientId, batch);
      return;
    }
    ensureClientIdReady()
      .then((id) => send(id, batch))
      .catch(() => {
        // clientId를 못 구하면(IndexedDB 사용 불가 등) 이 배치는 유실한다 — 재시도 없음(01 최종 일관성 허용).
      });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return {
    track(event, props) {
      if (!WHITELISTED_NAMES.includes(event)) return;
      const entry: QueuedEvent = { name: event, clientTs: Date.now(), ...(props !== undefined ? { props } : {}) };
      queue.push(entry);
      if (dev) {
        console.log('[analytics]', entry.name, entry.props ?? {});
      }
      if (queue.length >= FLUSH_QUEUE_SIZE) {
        flush();
        return;
      }
      flushTimer ??= setTimeout(flush, FLUSH_INTERVAL_MS);
    },
  };
}
