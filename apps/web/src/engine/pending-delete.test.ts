import { MemoryLocalStore } from '@offside/engine-client';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '../api/client.js';
import { classifyDeleteResult, queuePendingDelete, retryPendingDeletes } from './pending-delete.js';

const deleteCareerOnServerMock = vi.fn<(careerId: string) => Promise<ApiResult<undefined>>>();
vi.mock('../api/client.js', () => ({
  deleteCareerOnServer: (careerId: string) => deleteCareerOnServerMock(careerId),
}));

function ok(): ApiResult<undefined> {
  return { ok: true, data: undefined };
}

function fail(code: string, retryable: boolean): ApiResult<undefined> {
  return { ok: false, error: { code: code as never, message: '실패', retryable } };
}

describe('classifyDeleteResult', () => {
  it('성공은 success다', () => {
    expect(classifyDeleteResult(ok())).toBe('success');
  });

  it.each(['CAREER_NOT_FOUND', 'CAREER_NOT_OWNED', 'PROFILE_REQUIRED'] as const)(
    '%s는 서버에 이미 없다는 뜻이라 success다(retryable 여부와 무관)',
    (code) => {
      expect(classifyDeleteResult(fail(code, false))).toBe('success');
      expect(classifyDeleteResult(fail(code, true))).toBe('success');
    },
  );

  it('retryable한 그 외 실패(네트워크·5xx·RATE_LIMITED)는 retry다', () => {
    expect(classifyDeleteResult(fail('NETWORK_ERROR', true))).toBe('retry');
    expect(classifyDeleteResult(fail('RATE_LIMITED', true))).toBe('retry');
    expect(classifyDeleteResult(fail('SERVICE_UNAVAILABLE', true))).toBe('retry');
  });

  it('retryable하지 않은 그 외 실패는 drop이다', () => {
    expect(classifyDeleteResult(fail('VALIDATION_FAILED', false))).toBe('drop');
    expect(classifyDeleteResult(fail('INVALID_RESPONSE', false))).toBe('drop');
  });
});

describe('queuePendingDelete·retryPendingDeletes', () => {
  it('큐에 쌓인 careerId 중 재시도에 성공한 것만 큐에서 빠진다', async () => {
    const store = new MemoryLocalStore();
    await queuePendingDelete(store, 'car_1');
    await queuePendingDelete(store, 'car_2');

    deleteCareerOnServerMock.mockImplementation((careerId) =>
      Promise.resolve(careerId === 'car_1' ? ok() : fail('NETWORK_ERROR', true)),
    );

    await retryPendingDeletes(store);

    const remaining = await store.transaction('readonly', (tx) => tx.kv.get<string[]>('sync:pending-delete'));
    expect(remaining).toEqual(['car_2']);
  });

  it('같은 careerId를 두 번 큐잉해도 한 번만 남는다', async () => {
    const store = new MemoryLocalStore();
    await queuePendingDelete(store, 'car_1');
    await queuePendingDelete(store, 'car_1');

    const queued = await store.transaction('readonly', (tx) => tx.kv.get<string[]>('sync:pending-delete'));
    expect(queued).toEqual(['car_1']);
  });
});
