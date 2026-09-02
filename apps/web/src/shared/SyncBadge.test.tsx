import type { CareerSyncState } from '@offside/engine-client';
import { describe, expect, it } from 'vitest';
import { describeSyncState } from './SyncBadge.js';

const SAMPLE_SNAPSHOT = { careerId: 'car_1' } as never;

// 06 문구 표 전수. 그대로 쓴다 — 색은 참고용, 문구가 항상 있어야 한다.
const CASES: Array<{ state: CareerSyncState; text: string; hasTime: boolean }> = [
  { state: { kind: 'IDLE', lastSyncedRevision: 3, lastSyncedAt: '2026-09-02T00:00:00Z' }, text: '저장됨', hasTime: true },
  { state: { kind: 'IDLE', lastSyncedRevision: 0, lastSyncedAt: null }, text: '아직 저장 안 됨', hasTime: false },
  { state: { kind: 'SCHEDULED', dueAt: 0 }, text: '저장 중', hasTime: false },
  { state: { kind: 'SYNCING', attempt: 1 }, text: '저장 중', hasTime: false },
  {
    state: { kind: 'RETRYING', attempt: 1, nextAt: 0, lastError: { code: 'RATE_LIMITED', message: 'x' } },
    text: '저장 다시 시도 중',
    hasTime: false,
  },
  { state: { kind: 'OFFLINE', pendingSince: '2026-09-02T00:00:00Z' }, text: '오프라인 · 이 기기에만 저장됨', hasTime: false },
  { state: { kind: 'LOCAL_ONLY', reason: 'NO_SESSION' }, text: '로컬 전용', hasTime: false },
  {
    state: {
      kind: 'CONFLICT',
      local: { revision: 1, stateHash: 'h1' },
      server: { revision: 2, stateHash: 'h2', snapshot: SAMPLE_SNAPSHOT },
    },
    text: '다른 기기와 어긋남',
    hasTime: false,
  },
  { state: { kind: 'FAILED', error: { code: 'VALIDATION_FAILED', message: 'x' } }, text: '서버 저장 실패', hasTime: false },
];

describe('describeSyncState: SyncBadge 문구 표 전수', () => {
  it.each(CASES)('$state.kind → "$text"', ({ state, text, hasTime }) => {
    const copy = describeSyncState(state);
    expect(copy.text).toBe(text);
    expect(copy.lastSyncedAtIso !== undefined).toBe(hasTime);
  });

  it('9개 상태 변형(IDLE 2종 포함)을 전부 다룬다', () => {
    expect(CASES).toHaveLength(9);
  });
});
