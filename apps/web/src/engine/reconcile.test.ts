// D-20 대조 표: KEEP_LINKED_ONLY·MOVE_TO_LINKED·NONE × 로컬만·서버만·둘 다(동기화됨)·둘 다(미전송).
import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { planReconciliation, reconcileAfterRecovery, type ReconcileLocalCareer, type ReconcileServerCareer } from './reconcile.js';

const listRemoteCareersMock = vi.fn();
const getRemoteCareerMock = vi.fn();
vi.mock('../api/client.js', () => ({
  listRemoteCareers: (cursor?: string) => listRemoteCareersMock(cursor),
  getRemoteCareer: (careerId: string) => getRemoteCareerMock(careerId),
}));

// importCareerFromServer 자체(decodeSnapshot·트랜잭션 반영)는 packages/engine-client의
// import.test.ts가 이미 검사한다 — 여기서는 reconcileAfterRecovery가 그 결과(성공·실패)를
// 어떻게 집계하는지만 본다.
const importCareerFromServerMock = vi.fn();
vi.mock('@offside/engine-client', () => ({
  importCareerFromServer: (...args: unknown[]) => importCareerFromServerMock(...args),
}));

const listCareersMock = vi.fn().mockResolvedValue([]);
// getAppEngine()은 대조 실패 경로에서는 반환값을 쓰지 않는다 — 존재만 하면 된다.
vi.mock('./engine.js', () => ({
  getAppEngine: () => Promise.resolve({ client: { listCareers: () => listCareersMock() }, store: {} }),
}));

const LOCAL_ONLY_SYNCED: ReconcileLocalCareer = { id: 'car_local_only', revision: 3, lastSyncedRevision: 3 };
const LOCAL_ONLY_UNSENT: ReconcileLocalCareer = { id: 'car_local_unsent', revision: 5, lastSyncedRevision: 2 };
const BOTH_IN_SYNC_LOCAL: ReconcileLocalCareer = { id: 'car_both_sync', revision: 4, lastSyncedRevision: 4 };
const BOTH_IN_SYNC_SERVER: ReconcileServerCareer = { id: 'car_both_sync', revision: 4 };
const BOTH_BEHIND_LOCAL: ReconcileLocalCareer = { id: 'car_both_behind', revision: 1, lastSyncedRevision: 1 };
const BOTH_BEHIND_SERVER: ReconcileServerCareer = { id: 'car_both_behind', revision: 3 };
const BOTH_UNSENT_AHEAD_LOCAL: ReconcileLocalCareer = { id: 'car_both_unsent', revision: 6, lastSyncedRevision: 2 };
const BOTH_UNSENT_AHEAD_SERVER: ReconcileServerCareer = { id: 'car_both_unsent', revision: 4 };
const SERVER_ONLY: ReconcileServerCareer = { id: 'car_server_only', revision: 1 };

describe('planReconciliation', () => {
  it('KEEP_LINKED_ONLY: 로컬만 있는 커리어는 삭제 대상이다', () => {
    const plan = planReconciliation('KEEP_LINKED_ONLY', [LOCAL_ONLY_SYNCED], []);
    expect(plan.toDelete).toEqual(['car_local_only']);
    expect(plan.toNotifyCommitted).toEqual([]);
    expect(plan.toDownload).toEqual([]);
  });

  it('KEEP_LINKED_ONLY: 로컬에 미전송분이 있어도 서버에 없으면 그대로 삭제 대상이다', () => {
    const plan = planReconciliation('KEEP_LINKED_ONLY', [LOCAL_ONLY_UNSENT], []);
    expect(plan.toDelete).toEqual(['car_local_unsent']);
  });

  it('KEEP_LINKED_ONLY: 서버만 있는 커리어는 다운로드 대상이고 삭제되지 않는다', () => {
    const plan = planReconciliation('KEEP_LINKED_ONLY', [], [SERVER_ONLY]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toDownload).toEqual(['car_server_only']);
  });

  it('KEEP_LINKED_ONLY: 둘 다 있고 동기화된 커리어는 지우지도 받지도 않는다', () => {
    const plan = planReconciliation('KEEP_LINKED_ONLY', [BOTH_IN_SYNC_LOCAL], [BOTH_IN_SYNC_SERVER]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toDownload).toEqual([]);
  });

  it('KEEP_LINKED_ONLY: 둘 다 있고 로컬이 뒤처졌으며 미전송분이 없으면 다운로드한다', () => {
    const plan = planReconciliation('KEEP_LINKED_ONLY', [BOTH_BEHIND_LOCAL], [BOTH_BEHIND_SERVER]);
    expect(plan.toDownload).toEqual(['car_both_behind']);
  });

  it('KEEP_LINKED_ONLY: 둘 다 있고 로컬에 미전송분이 있으면(로컬이 더 앞서도) 덮어쓰지 않는다', () => {
    const plan = planReconciliation('KEEP_LINKED_ONLY', [BOTH_UNSENT_AHEAD_LOCAL], [BOTH_UNSENT_AHEAD_SERVER]);
    expect(plan.toDownload).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it('MOVE_TO_LINKED: 로컬만 있고 미전송분이 있으면 notifyCommitted 대상이고 지워지지 않는다', () => {
    const plan = planReconciliation('MOVE_TO_LINKED', [LOCAL_ONLY_UNSENT], []);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toNotifyCommitted).toEqual(['car_local_unsent']);
  });

  it('MOVE_TO_LINKED: 로컬만 있고 이미 동기화됐으면 notifyCommitted 대상이 아니다', () => {
    const plan = planReconciliation('MOVE_TO_LINKED', [LOCAL_ONLY_SYNCED], []);
    expect(plan.toNotifyCommitted).toEqual([]);
  });

  it('MOVE_TO_LINKED: 서버만 있는 커리어는 다운로드 대상이다', () => {
    const plan = planReconciliation('MOVE_TO_LINKED', [], [SERVER_ONLY]);
    expect(plan.toDownload).toEqual(['car_server_only']);
  });

  it('MOVE_TO_LINKED: 둘 다 있고 로컬이 뒤처졌으며 미전송분이 없으면 다운로드한다', () => {
    const plan = planReconciliation('MOVE_TO_LINKED', [BOTH_BEHIND_LOCAL], [BOTH_BEHIND_SERVER]);
    expect(plan.toDownload).toEqual(['car_both_behind']);
  });

  it('MOVE_TO_LINKED: 둘 다 있고 로컬에 미전송분이 있으면 notifyCommitted만 하고 덮어쓰지 않는다', () => {
    const plan = planReconciliation('MOVE_TO_LINKED', [BOTH_UNSENT_AHEAD_LOCAL], [BOTH_UNSENT_AHEAD_SERVER]);
    expect(plan.toNotifyCommitted).toEqual(['car_both_unsent']);
    expect(plan.toDownload).toEqual([]);
  });

  it('NONE: MOVE_TO_LINKED와 로컬 처리(삭제 없음·미전송 notifyCommitted)가 같다', () => {
    const plan = planReconciliation('NONE', [LOCAL_ONLY_UNSENT, LOCAL_ONLY_SYNCED], [SERVER_ONLY]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toNotifyCommitted).toEqual(['car_local_unsent']);
    expect(plan.toDownload).toEqual(['car_server_only']);
  });

  it('여러 커리어가 섞여도 각각 독립적으로 판정한다', () => {
    const plan = planReconciliation(
      'KEEP_LINKED_ONLY',
      [LOCAL_ONLY_SYNCED, BOTH_IN_SYNC_LOCAL, BOTH_BEHIND_LOCAL],
      [BOTH_IN_SYNC_SERVER, BOTH_BEHIND_SERVER, SERVER_ONLY],
    );
    expect(plan.toDelete).toEqual(['car_local_only']);
    expect(plan.toDownload).toEqual(['car_both_behind', 'car_server_only']);
  });
});

describe('reconcileAfterRecovery', () => {
  it('서버 커리어 목록을 받지 못하면 로컬 대조를 하지 않고 ok:false를 돌려준다', async () => {
    listRemoteCareersMock.mockResolvedValue({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: '실패', retryable: true },
    });
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    const result = await reconcileAfterRecovery('NONE', queryClient);

    // 설정 화면(ProfileRecoverRow)은 이 ok:false를 보고 "커리어 목록을 불러오지 못했습니다" 경고
    // 토스트로 갈아탄다(성공 토스트를 그대로 보여주지 않는다).
    expect(result).toEqual({ ok: false, failed: [] });
    // recoverProfile은 이미 성공해 세션이 새 프로필로 바뀐 뒤다 — 커리어 대조를 못 했어도 ['profile']
    // 캐시(발급일·linked 등)는 갱신해야 한다.
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('여러 건 중 일부만 가져오기에 실패하면 ok:false로 알리되, 성공한 나머지는 반영한다', async () => {
    listRemoteCareersMock.mockResolvedValue({
      ok: true,
      data: {
        items: [
          { id: 'car_ok', revision: 2 },
          { id: 'car_fail', revision: 2 },
        ],
        nextCursor: null,
      },
    });
    getRemoteCareerMock.mockImplementation((careerId: string) =>
      Promise.resolve({ ok: true, data: { snapshot: { careerId }, commands: [] } }),
    );
    importCareerFromServerMock.mockImplementation((_store: unknown, response: { snapshot: { careerId: string } }) =>
      Promise.resolve(
        response.snapshot.careerId === 'car_fail'
          ? { ok: false, error: { code: 'VERIFICATION_FAILED', message: '검증 실패' } }
          : { ok: true, revision: 2 },
      ),
    );
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    const result = await reconcileAfterRecovery('NONE', queryClient);

    expect(result).toEqual({ ok: false, failed: ['car_fail'] });
    // car_ok는 반영됐으니 화면은 그래도 갱신한다.
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
