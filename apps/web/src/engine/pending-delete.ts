// 서버 삭제가 실패한 커리어를 kv sync:pending-delete(careerId 배열)에 쌓아 두고 앱 시작·online
// 때 재시도한다. 로컬 삭제는 이미 끝난 뒤라 여기서는 서버 DELETE만 다시 부른다.
import type { LocalStore } from '@offside/engine-client';
import { deleteCareerOnServer, type ApiResult } from '../api/client.js';

const PENDING_DELETE_KEY = 'sync:pending-delete';
export const pendingDeleteKey = PENDING_DELETE_KEY;

export async function assertNotPendingDelete(store: LocalStore, careerId: string): Promise<void> {
  if ((await readPending(store)).includes(careerId))
    throw Object.assign(new Error('삭제를 요청한 커리어입니다.'), { code: 'CAREER_NOT_FOUND' });
}

export type DeleteOutcome = 'success' | 'retry' | 'drop';

/**
 * CAREER_NOT_FOUND·CAREER_NOT_OWNED는 서버에 이미 없다는 뜻이라 성공으로 본다. PROFILE_REQUIRED
 * (401)는 다르다 — "서버에 없다"가 아니라 "지금 세션이 없어 누구인지 모른다"이므로, 여기서 성공
 * 처리하면 쿠키를 잃은 채 지운 커리어가 서버에 그대로 남아 "다시 연결" 뒤에도(Phase 3 다른 기기
 * 이어하기 때) 되살아난다. 재시도 대상으로 큐에 남긴다. 그 외에는 retryable 여부로 재시도할지
 * (retry) 포기할지(drop) 가른다.
 */
export function classifyDeleteResult(result: ApiResult<undefined>): DeleteOutcome {
  if (result.ok) return 'success';
  const { code, retryable } = result.error;
  if (code === 'CAREER_NOT_FOUND' || code === 'CAREER_NOT_OWNED') return 'success';
  if (code === 'PROFILE_REQUIRED') return 'retry';
  return retryable ? 'retry' : 'drop';
}

async function readPending(store: LocalStore): Promise<string[]> {
  return store.transaction('readonly', async (tx) => (await tx.kv.get<string[]>(PENDING_DELETE_KEY)) ?? []);
}

/**
 * queuePendingDelete와 retryPendingDeletes의 마무리 쓰기는 각각 get+put을 같은 트랜잭션 안에서
 * 한다. 따로 트랜잭션을 열어 읽고 쓰면(TOCTOU) 그 사이 다른 호출이 끼어들어 방금 쓴 careerId를
 * 잃어버릴 수 있다(동시에 커리어 두 개를 지우거나, online 재시도 도중 새로 지우는 경우).
 */
export async function queuePendingDelete(store: LocalStore, careerId: string): Promise<void> {
  await store.transaction('readwrite', async (tx) => {
    const ids = (await tx.kv.get<string[]>(PENDING_DELETE_KEY)) ?? [];
    if (!ids.includes(careerId)) {
      await tx.kv.put(PENDING_DELETE_KEY, [...ids, careerId]);
    }
  });
}

/** 큐에 남은 careerId마다 서버 삭제를 다시 시도하고, 재시도 대상만 큐에 남긴다. */
export async function retryPendingDeletes(store: LocalStore): Promise<void> {
  const ids = await readPending(store);
  if (ids.length === 0) return;

  const outcomes = new Map<string, DeleteOutcome>();
  for (const careerId of ids) {
    const result = await deleteCareerOnServer(careerId);
    outcomes.set(careerId, classifyDeleteResult(result));
  }

  await store.transaction('readwrite', async (tx) => {
    const current = (await tx.kv.get<string[]>(PENDING_DELETE_KEY)) ?? [];
    const next = current.filter((id) => {
      const outcome = outcomes.get(id);
      return outcome !== 'success' && outcome !== 'drop';
    });
    await tx.kv.put(PENDING_DELETE_KEY, next);
  });
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
