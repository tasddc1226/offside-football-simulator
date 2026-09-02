import type { CareerSyncState } from '@offside/engine-client';
import { describe, expect, it } from 'vitest';
import { pickWorstSyncState } from './use-sync.js';

const STATE_BY_KIND: Record<CareerSyncState['kind'], CareerSyncState> = {
  IDLE: { kind: 'IDLE', lastSyncedRevision: 0, lastSyncedAt: null },
  SCHEDULED: { kind: 'SCHEDULED', dueAt: 0 },
  SYNCING: { kind: 'SYNCING', attempt: 1 },
  RETRYING: { kind: 'RETRYING', attempt: 1, nextAt: 0, lastError: { code: 'RATE_LIMITED', message: 'x' } },
  OFFLINE: { kind: 'OFFLINE', pendingSince: '2026-01-01T00:00:00Z' },
  LOCAL_ONLY: { kind: 'LOCAL_ONLY', reason: 'NO_SESSION' },
  CONFLICT: {
    kind: 'CONFLICT',
    local: { revision: 1, stateHash: 'h1' },
    server: { revision: 2, stateHash: 'h2', snapshot: { careerId: 'car_1' } as never },
  },
  FAILED: { kind: 'FAILED', error: { code: 'VALIDATION_FAILED', message: 'x' } },
};

// CONFLICT > FAILED > LOCAL_ONLY > OFFLINE > RETRYING > SYNCING·SCHEDULED(동순위) > IDLE.
const MOST_URGENT_FIRST: CareerSyncState['kind'][] = [
  'CONFLICT',
  'FAILED',
  'LOCAL_ONLY',
  'OFFLINE',
  'RETRYING',
  'SYNCING',
  'IDLE',
];

describe('pickWorstSyncState: 요약 우선순위', () => {
  it('빈 배열이면 undefined다', () => {
    expect(pickWorstSyncState([])).toBeUndefined();
  });

  it('전수: 표의 각 순서쌍에서 더 급한 쪽을 고른다', () => {
    for (let i = 0; i < MOST_URGENT_FIRST.length; i++) {
      for (let j = i + 1; j < MOST_URGENT_FIRST.length; j++) {
        const urgent = STATE_BY_KIND[MOST_URGENT_FIRST[i]!];
        const calm = STATE_BY_KIND[MOST_URGENT_FIRST[j]!];
        expect(pickWorstSyncState([calm, urgent])).toBe(urgent);
        expect(pickWorstSyncState([urgent, calm])).toBe(urgent);
      }
    }
  });

  it('SYNCING·SCHEDULED는 동순위이고 둘 다 IDLE보다 급하다', () => {
    expect(pickWorstSyncState([STATE_BY_KIND.SYNCING, STATE_BY_KIND.SCHEDULED])).toBeDefined();
    expect(pickWorstSyncState([STATE_BY_KIND.IDLE, STATE_BY_KIND.SCHEDULED])).toBe(STATE_BY_KIND.SCHEDULED);
    expect(pickWorstSyncState([STATE_BY_KIND.IDLE, STATE_BY_KIND.SYNCING])).toBe(STATE_BY_KIND.SYNCING);
  });

  it('단일 상태는 그대로 돌려준다(참조 동일)', () => {
    expect(pickWorstSyncState([STATE_BY_KIND.OFFLINE])).toBe(STATE_BY_KIND.OFFLINE);
  });
});
