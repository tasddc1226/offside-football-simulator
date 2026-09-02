import type { CareerSyncState, LocalCareerRecord } from '@offside/engine-client';
import { describe, expect, it } from 'vitest';
import { displaySyncState, pickWorstSyncState } from './use-sync.js';

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

function record(revision: number, lastSyncedRevision: number): Pick<LocalCareerRecord, 'revision' | 'lastSyncedRevision' | 'updatedAt'> {
  return { revision, lastSyncedRevision, updatedAt: '2026-01-01T00:00:00Z' };
}

describe('displaySyncState: 새로고침 뒤 세션 스코프 IDLE 보정', () => {
  it('IDLE·lastSyncedAt null인데 record가 이미 최신 revision까지 저장됐으면 저장됨으로 보정한다', () => {
    const result = displaySyncState(STATE_BY_KIND.IDLE, record(3, 3));
    expect(result).toEqual({ kind: 'IDLE', lastSyncedRevision: 3, lastSyncedAt: '2026-01-01T00:00:00Z' });
  });

  it('record가 IDLE보다 앞서 있어도(lastSyncedRevision > revision) 보정한다', () => {
    const result = displaySyncState(STATE_BY_KIND.IDLE, record(2, 3));
    expect(result.kind).toBe('IDLE');
    expect((result as { lastSyncedAt: string | null }).lastSyncedAt).not.toBeNull();
  });

  it('record가 아직 한 번도 안 저장됐으면(lastSyncedRevision < revision) 보정하지 않는다', () => {
    expect(displaySyncState(STATE_BY_KIND.IDLE, record(2, 0))).toBe(STATE_BY_KIND.IDLE);
    expect(displaySyncState(STATE_BY_KIND.IDLE, record(2, 1))).toBe(STATE_BY_KIND.IDLE);
  });

  it('record가 revision 0(아직 아무 것도 확정 안 됨)이면 보정하지 않는다', () => {
    expect(displaySyncState(STATE_BY_KIND.IDLE, record(0, 0))).toBe(STATE_BY_KIND.IDLE);
  });

  it('record가 없으면(아직 로드되지 않음) 보정하지 않는다', () => {
    expect(displaySyncState(STATE_BY_KIND.IDLE, undefined)).toBe(STATE_BY_KIND.IDLE);
  });

  it('이미 lastSyncedAt이 있는 IDLE은 그대로 둔다', () => {
    const idleWithTime: CareerSyncState = { kind: 'IDLE', lastSyncedRevision: 3, lastSyncedAt: '2026-01-01T00:00:00Z' };
    expect(displaySyncState(idleWithTime, record(3, 3))).toBe(idleWithTime);
  });

  it('IDLE이 아닌 상태는 record와 무관하게 그대로 둔다', () => {
    for (const kind of ['SCHEDULED', 'SYNCING', 'RETRYING', 'OFFLINE', 'LOCAL_ONLY', 'CONFLICT', 'FAILED'] as const) {
      expect(displaySyncState(STATE_BY_KIND[kind], record(3, 3))).toBe(STATE_BY_KIND[kind]);
    }
  });
});
