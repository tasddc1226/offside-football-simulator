// React 훅(useSyncExternalStore) — SyncClient 상태를 화면에 연결한다. sync.ts의 getSyncClient()가
// 지연 싱글턴이라, 훅은 그 Promise가 풀리기 전에도 안전하게 부를 수 있게 IDLE(미저장) 기본값을
// 돌려준다.
import { useCallback, useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import type { CareerSyncState, SyncClient } from '@offside/engine-client';
import { platform } from '../platform/index.js';
import { getSyncClient } from './sync.js';
import { useCareerList } from './use-career.js';

const DEFAULT_STATE: CareerSyncState = { kind: 'IDLE', lastSyncedRevision: 0, lastSyncedAt: null };

/** 06 "분석 이벤트": 요약 우선순위. 낮을수록 급하다. SYNCING·SCHEDULED는 문구가 같아 동순위다. */
const SYNC_STATE_PRIORITY: Record<CareerSyncState['kind'], number> = {
  CONFLICT: 0,
  FAILED: 1,
  LOCAL_ONLY: 2,
  OFFLINE: 3,
  RETRYING: 4,
  SYNCING: 5,
  SCHEDULED: 5,
  IDLE: 6,
};

/** 여러 커리어의 상태 중 가장 급한 것 하나를 고른다. 빈 배열이면 undefined. */
export function pickWorstSyncState(states: readonly CareerSyncState[]): CareerSyncState | undefined {
  let worst: CareerSyncState | undefined;
  for (const state of states) {
    if (worst === undefined || SYNC_STATE_PRIORITY[state.kind] < SYNC_STATE_PRIORITY[worst.kind]) {
      worst = state;
    }
  }
  return worst;
}

let client: SyncClient | null = null;
const subscribers = new Set<() => void>();
const lastAnnouncedKind = new Map<string, CareerSyncState['kind']>();

/**
 * SyncClient.getState()는 아직 레코드가 없는 careerId에 대해 매번 새 객체 리터럴을
 * `{kind:'IDLE', lastSyncedRevision:0, lastSyncedAt:null}`로 만들어 돌려준다(engine-client는
 * 수정 범위 밖). useSyncExternalStore는 getSnapshot이 매 호출 다른 참조를 돌려주면 무한
 * 렌더 루프로 본다 — 그 모양과 값이 같으면 안정된 DEFAULT_STATE 참조로 바꿔치기한다.
 */
function stableState(state: CareerSyncState): CareerSyncState {
  return state.kind === 'IDLE' && state.lastSyncedRevision === 0 && state.lastSyncedAt === null ? DEFAULT_STATE : state;
}

function notifySubscribers(): void {
  for (const subscriber of subscribers) subscriber();
}

function ensureClientBridge(): void {
  if (client !== null) return;
  void getSyncClient().then((sync) => {
    client = sync;
    sync.subscribe((careerId, state) => {
      if (lastAnnouncedKind.get(careerId) !== state.kind) {
        lastAnnouncedKind.set(careerId, state.kind);
        platform.analytics.track('sync_state_changed', { kind: state.kind });
      }
      notifySubscribers();
    });
    notifySubscribers();
  });
}

function subscribe(onStoreChange: () => void): () => void {
  ensureClientBridge();
  subscribers.add(onStoreChange);
  return () => subscribers.delete(onStoreChange);
}

/** 특정 커리어의 동기화 상태. 클라이언트가 준비되기 전에는 IDLE(미저장)로 본다. */
export function useSyncState(careerId: string): CareerSyncState {
  const getSnapshot = useCallback(
    () => (client === null ? DEFAULT_STATE : stableState(client.getState(careerId))),
    [careerId],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** 로컬에 있는 모든 커리어 중 가장 급한 동기화 상태 하나(허브·설정 요약 배지용). */
export function useSyncSummary(): CareerSyncState {
  const { data } = useCareerList();
  const careerIds = useMemo(() => (data ?? []).map((summary) => summary.record.id), [data]);

  const getSnapshot = useCallback((): CareerSyncState => {
    if (client === null) return DEFAULT_STATE;
    const states = careerIds.map((id) => stableState(client!.getState(id)));
    return pickWorstSyncState(states) ?? DEFAULT_STATE;
  }, [careerIds]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
