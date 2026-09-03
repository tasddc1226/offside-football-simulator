// React 훅(useSyncExternalStore) — SyncClient 상태를 화면에 연결한다. sync.ts의 getSyncClient()가
// 지연 싱글턴이라, 훅은 그 Promise가 풀리기 전에도 안전하게 부를 수 있게 IDLE(미저장) 기본값을
// 돌려준다.
import { useCallback, useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import type { CareerSyncState, LocalCareerRecord, SyncClient } from '@offside/engine-client';
import { platform } from '../platform/index.js';
import { getSyncClient } from './sync.js';
import { useCareer, useCareerList } from './use-career.js';

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

/**
 * displaySyncState의 "이미 저장됨" 보정이 만드는 객체를 record별로 캐싱한다. useSyncSummary는 이
 * 함수를 useSyncExternalStore의 getSnapshot 안에서 직접 부른다 — 매 호출 새 객체 리터럴을 돌려주면
 * (record 참조가 같은데도) getSnapshot이 매번 "달라졌다"고 보여 무한 렌더 루프에 빠진다(실제로
 * 겪음 — react-query의 구조 공유로 record 참조는 안 바뀌지만 이 함수가 그때마다 새로 만들었다).
 */
const correctedStateCache = new WeakMap<object, CareerSyncState>();

/**
 * SyncClient의 상태는 세션(메모리) 스코프다 — 새로고침하면 레코드가 없어 `getState()`가 항상
 * `IDLE/0/null`("아직 저장 안 됨")을 돌려준다. 이미 서버에 저장된 커리어라도 새로고침 뒤에는
 * 저장 안 됨으로 보여 신뢰를 깎아 먹는다. `LocalCareerRecord`(revision·lastSyncedRevision는 DB에
 * 영속된다)를 함께 봐서, 로컬 기록상 이미 최신 revision까지 저장된 상태면 "저장됨"으로 보정한다.
 * 정확한 마지막 저장 시각은 모르니 `record.updatedAt`(마지막으로 로컬에 쓴 시각)을 대신 쓴다.
 */
export function displaySyncState(
  state: CareerSyncState,
  record: Pick<LocalCareerRecord, 'revision' | 'lastSyncedRevision' | 'updatedAt'> | undefined,
): CareerSyncState {
  if (state.kind !== 'IDLE' || state.lastSyncedAt !== null) return state;
  if (record === undefined || record.revision === 0) return state;
  if (record.lastSyncedRevision < record.revision) return state;

  const cached = correctedStateCache.get(record);
  if (cached !== undefined) return cached;
  const corrected: CareerSyncState = { kind: 'IDLE', lastSyncedRevision: record.lastSyncedRevision, lastSyncedAt: record.updatedAt };
  correctedStateCache.set(record, corrected);
  return corrected;
}

function notifySubscribers(): void {
  for (const subscriber of subscribers) subscriber();
}

function ensureClientBridge(): void {
  if (client !== null) return;
  void getSyncClient()
    .then((sync) => {
      client = sync;
      sync.subscribe((careerId, state) => {
        if (lastAnnouncedKind.get(careerId) !== state.kind) {
          lastAnnouncedKind.set(careerId, state.kind);
          platform.analytics.track('sync_state_changed', { kind: state.kind });
        }
        notifySubscribers();
      });
      notifySubscribers();
    })
    .catch((error: unknown) => {
      // client가 계속 null이면 배지는 DEFAULT_STATE("아직 저장 안 됨")에 머문다 — 화면이
      // 멈추지는 않지만 원인을 콘솔에는 남긴다.
      console.error('ensureClientBridge: 동기화 클라이언트를 준비하지 못했다', error);
    });
}

function subscribe(onStoreChange: () => void): () => void {
  ensureClientBridge();
  subscribers.add(onStoreChange);
  return () => subscribers.delete(onStoreChange);
}

/**
 * 특정 커리어의 동기화 상태. 클라이언트가 준비되기 전에는 IDLE(미저장)로 본다. `LocalCareerRecord`가
 * 있으면(이미 로드된 커리어) `displaySyncState`로 새로고침 직후의 "아직 저장 안 됨" 오표시를 보정한다.
 */
export function useSyncState(careerId: string): CareerSyncState {
  const { data } = useCareer(careerId);
  const getSnapshot = useCallback(
    () => (client === null ? DEFAULT_STATE : stableState(client.getState(careerId))),
    [careerId],
  );
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => displaySyncState(state, data?.record), [state, data?.record]);
}

/** 로컬에 있는 모든 커리어 중 가장 급한 동기화 상태 하나(허브·설정 요약 배지용). */
export function useSyncSummary(): CareerSyncState {
  const { data } = useCareerList();
  const summaries = useMemo(() => data ?? [], [data]);

  const getSnapshot = useCallback((): CareerSyncState => {
    if (client === null) return DEFAULT_STATE;
    const states = summaries.map((summary) => displaySyncState(stableState(client!.getState(summary.record.id)), summary.record));
    return pickWorstSyncState(states) ?? DEFAULT_STATE;
  }, [summaries]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
