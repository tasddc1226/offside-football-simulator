// 서버 삭제가 실패한 커리어를 kv sync:pending-delete(careerId 배열)에 쌓아 두고 앱 시작·online
// 때 재시도한다. 로컬 삭제는 이미 끝난 뒤라 여기서는 서버 DELETE만 다시 부른다.
import type { LocalStore } from '@offside/engine-client';
import { deleteCareerOnServer, type ApiResult } from '../api/client.js';

const PENDING_DELETE_KEY = 'sync:pending-delete';

export type DeleteOutcome = 'success' | 'retry' | 'drop';

/**
 * CAREER_NOT_FOUND·CAREER_NOT_OWNED·PROFILE_REQUIRED(401)는 서버에 이미 없다는 뜻이라
 * 성공으로 본다. 그 외에는 retryable 여부로 재시도할지(retry) 포기할지(drop) 가른다.
 */
export function classifyDeleteResult(result: ApiResult<undefined>): DeleteOutcome {
  if (result.ok) return 'success';
  const { code, retryable } = result.error;
  if (code === 'CAREER_NOT_FOUND' || code === 'CAREER_NOT_OWNED' || code === 'PROFILE_REQUIRED') {
    return 'success';
  }
  return retryable ? 'retry' : 'drop';
}

async function readPending(store: LocalStore): Promise<string[]> {
  return store.transaction('readonly', async (tx) => (await tx.kv.get<string[]>(PENDING_DELETE_KEY)) ?? []);
}

async function writePending(store: LocalStore, ids: string[]): Promise<void> {
  await store.transaction('readwrite', async (tx) => {
    await tx.kv.put(PENDING_DELETE_KEY, ids);
  });
}

export async function queuePendingDelete(store: LocalStore, careerId: string): Promise<void> {
  const ids = await readPending(store);
  if (!ids.includes(careerId)) {
    await writePending(store, [...ids, careerId]);
  }
}

/** 큐에 남은 careerId마다 서버 삭제를 다시 시도하고, 재시도 대상만 큐에 남긴다. */
export async function retryPendingDeletes(store: LocalStore): Promise<void> {
  const ids = await readPending(store);
  if (ids.length === 0) return;

  const remaining: string[] = [];
  for (const careerId of ids) {
    const result = await deleteCareerOnServer(careerId);
    if (classifyDeleteResult(result) === 'retry') {
      remaining.push(careerId);
    }
  }
  await writePending(store, remaining);
}

let listenerRegistered = false;

/** online 이벤트에서 재시도를 건다. 앱 부트스트랩에서 한 번만 부른다. */
export function startPendingDeleteRetryOnOnline(store: LocalStore): void {
  if (listenerRegistered) return;
  listenerRegistered = true;
  window.addEventListener('online', () => {
    void retryPendingDeletes(store);
  });
}
