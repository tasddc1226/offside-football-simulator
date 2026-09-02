// D-20 대조 표: KEEP_LINKED_ONLY·MOVE_TO_LINKED·NONE × 로컬만·서버만·둘 다(동기화됨)·둘 다(미전송).
import { describe, expect, it } from 'vitest';
import { planReconciliation, type ReconcileLocalCareer, type ReconcileServerCareer } from './reconcile.js';

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
