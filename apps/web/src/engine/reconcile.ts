// D-20 "복구 뒤 대조". `planReconciliation`은 무엇을 지우고 무엇을 받을지만 정하는 순수 함수라
// 엔진·API 없이 단위 테스트한다. `reconcileAfterRecovery`가 그 계획을 실제 엔진·API 호출로 실행한다.
import type { QueryClient } from '@tanstack/react-query';
import { importCareerFromServer } from '@offside/engine-client';
import { getRemoteCareer, listRemoteCareers } from '../api/client.js';
import { getAppEngine } from './engine.js';
import { resolveServiceSeasonId } from './service-season.js';
import { getSyncClient } from './sync.js';

export type ReconcileChoice = 'MOVE_TO_LINKED' | 'KEEP_LINKED_ONLY' | 'NONE';

export type ReconcileLocalCareer = { id: string; revision: number; lastSyncedRevision: number };
export type ReconcileServerCareer = { id: string; revision: number };

export type ReconcilePlan = {
  /** KEEP_LINKED_ONLY일 때만: 서버 목록에 없는 로컬 커리어(로컬만 삭제, 서버 호출 없음). */
  toDelete: string[];
  /** MOVE_TO_LINKED·NONE일 때만: 미전송(revision > lastSyncedRevision) 로컬 커리어. */
  toNotifyCommitted: string[];
  /** 선택과 무관: 로컬에 없거나 로컬이 뒤처졌고 미전송분이 없는 서버 커리어(다운로드 대상). */
  toDownload: string[];
};

/** 대조 표: KEEP_LINKED_ONLY·MOVE_TO_LINKED·NONE × 로컬만·서버만·둘 다·미전송. */
export function planReconciliation(
  choice: ReconcileChoice,
  local: readonly ReconcileLocalCareer[],
  server: readonly ReconcileServerCareer[],
): ReconcilePlan {
  const localById = new Map(local.map((career) => [career.id, career]));
  const serverIds = new Set(server.map((career) => career.id));

  const toDelete =
    choice === 'KEEP_LINKED_ONLY'
      ? local.filter((career) => !serverIds.has(career.id)).map((career) => career.id)
      : [];

  const toNotifyCommitted =
    choice === 'KEEP_LINKED_ONLY'
      ? []
      : local.filter((career) => career.revision > career.lastSyncedRevision).map((career) => career.id);

  const toDownload = server
    .filter((summary) => {
      const localCareer = localById.get(summary.id);
      if (localCareer === undefined) return true;
      const hasUnsent = localCareer.revision > localCareer.lastSyncedRevision;
      return localCareer.revision < summary.revision && !hasUnsent;
    })
    .map((summary) => summary.id);

  return { toDelete, toNotifyCommitted, toDownload };
}

async function fetchAllRemoteCareers(): Promise<ReconcileServerCareer[] | null> {
  const items: ReconcileServerCareer[] = [];
  let cursor: string | undefined;
  for (;;) {
    const result = await listRemoteCareers(cursor);
    if (!result.ok) return null;
    for (const item of result.data.items) {
      items.push({ id: item.id, revision: item.revision });
    }
    if (result.data.nextCursor === null) return items;
    cursor = result.data.nextCursor;
  }
}

/**
 * 서버 커리어 목록을 전 페이지 읽어 계획을 세우고 실행한다. kv `profile:id` 갱신은 호출하는 쪽
 * (설정 화면)이 복구 응답의 `profileId`로 한다 — 이 함수는 커리어 대조만 맡는다.
 */
export async function reconcileAfterRecovery(
  choice: ReconcileChoice,
  queryClient: QueryClient,
): Promise<{ ok: true } | { ok: false; failed: string[] }> {
  const engine = await getAppEngine();
  const serverCareers = await fetchAllRemoteCareers();
  if (serverCareers === null) {
    // 세션은 이미 새 프로필로 바뀐 뒤다(recoverProfile 성공) — 커리어 대조는 못 했어도 프로필
    // 쪽 캐시(발급일·linked 등)는 갱신해야 옛 프로필 상태로 남지 않는다.
    await queryClient.invalidateQueries();
    return { ok: false, failed: [] };
  }

  const localRecords = await engine.client.listCareers();
  const local: ReconcileLocalCareer[] = localRecords.map((record) => ({
    id: record.id,
    revision: record.revision,
    lastSyncedRevision: record.lastSyncedRevision,
  }));

  const plan = planReconciliation(choice, local, serverCareers);

  for (const careerId of plan.toDelete) {
    await engine.client.deleteCareer(careerId);
  }

  if (plan.toNotifyCommitted.length > 0) {
    const sync = await getSyncClient();
    for (const careerId of plan.toNotifyCommitted) {
      const load = await engine.client.loadCareer(careerId);
      if (load.ok) sync.notifyCommitted(careerId, load.snapshot);
    }
  }

  const now = new Date().toISOString();
  const failed: string[] = [];
  // GetCareerResponse는 원래 createdServiceSeasonId를 담지 않는다(서버 커리어 행에만 있다) — 다운로드
  // 항목 전체에 현재 시즌 포인터 하나를 쓴다(이 파일이 손대기 전부터 있던 한계, T-2-012 범위 밖).
  if (plan.toDownload.length > 0) {
    const createdServiceSeasonId = await resolveServiceSeasonId();
    for (const careerId of plan.toDownload) {
      const result = await getRemoteCareer(careerId);
      if (!result.ok) {
        failed.push(careerId);
        continue;
      }
      const imported = await importCareerFromServer(engine.store, result.data, {
        createdServiceSeasonId,
        now,
      });
      // CAREER_REVISION_CONFLICT는 이 기기의 미전송 진행을 보호하려는 의도된 건너뛰기라 실패로 세지 않는다.
      if (!imported.ok && imported.error.code !== 'CAREER_REVISION_CONFLICT') {
        failed.push(careerId);
      }
    }
  }

  // 일부만 실패해도 나머지는 반영됐으니 화면은 갱신한다.
  await queryClient.invalidateQueries();
  return failed.length > 0 ? { ok: false, failed } : { ok: true };
}
