// SyncClient 지연 싱글턴 배선. dispose()는 부르지 않는다(앱 수명과 같다).
import { createSyncClient, type SyncClient } from '@offside/engine-client';
import { API_BASE_URL } from '../api/client.js';
import { syncFetch } from '../api/sync-fetch.js';
import { getAppEngine } from './engine.js';

/** 저장하지 못한 채 남은 진행분(revision > lastSyncedRevision)을 전부 다시 큐에 올린다. */
async function requeueUnsynced(sync: SyncClient): Promise<void> {
  const engine = await getAppEngine();
  const records = await engine.client.listCareers();
  for (const record of records) {
    if (record.revision > record.lastSyncedRevision) {
      const load = await engine.client.loadCareer(record.id);
      if (load.ok) {
        sync.notifyCommitted(record.id, load.snapshot);
      }
    }
  }
}

async function createAppSyncClient(): Promise<SyncClient> {
  const engine = await getAppEngine();

  const sync = createSyncClient({
    engine: engine.client,
    store: engine.store,
    fetch: syncFetch,
    baseUrl: `${API_BASE_URL}/v1`,
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
    online: () => navigator.onLine,
    // 기본값(전역 setTimeout/clearTimeout을 그대로 참조한 객체 리터럴)은 브라우저에서
    // `timers.setTimeout(...)`로 호출되면 window에 바인딩되지 않아 "Illegal invocation"이
    // 난다. window에 묶어 넘긴다.
    timers: { setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window) },
  });

  window.addEventListener('online', () => {
    void sync.flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void sync.flush();
    }
  });
  window.addEventListener('pagehide', () => {
    void sync.flush();
  });

  // 이전 세션에서 저장하지 못한 채 남은 진행분을 다시 큐에 올린다.
  await requeueUnsynced(sync);

  return sync;
}

let syncClientPromise: Promise<SyncClient> | null = null;

export function getSyncClient(): Promise<SyncClient> {
  if (syncClientPromise === null) {
    syncClientPromise = createAppSyncClient();
  }
  return syncClientPromise;
}

/** 세션을 되찾은 뒤(설정의 "다시 연결") 미전송 커리어 전부를 다시 알린다. */
export async function requeueAllUnsynced(): Promise<void> {
  const sync = await getSyncClient();
  await requeueUnsynced(sync);
}
