// D-20 "복구 뒤 대조". `planReconciliation`은 무엇을 지우고 무엇을 받을지만 정하는 순수 함수라
// 엔진·API 없이 단위 테스트한다. `reconcileAfterRecovery`가 그 계획을 실제 엔진·API 호출로 실행한다.
import type { QueryClient } from '@tanstack/react-query';
import { loadRuleset } from '@offside/content';
import { importCareerFromServer } from '@offside/engine-client';
import { getRemoteCareer, listRemoteCareers } from '../api/client.js';
import { getAppEngine } from './engine.js';
import { getSyncClient } from './sync.js';
import { pendingDeleteKey } from './pending-delete.js';

export type ReconcileChoice = 'MOVE_TO_LINKED' | 'KEEP_LINKED_ONLY' | 'NONE';

export type ReconcileLocalCareer = {
  id: string;
  revision: number;
  lastSyncedRevision: number;
  authority?: string;
  rulesetVersion?: string;
};
export type ReconcileServerCareer = { id: string; revision: number; authority?: string };

export type ReconcilePlan = {
  /** KEEP_LINKED_ONLY일 때만: 서버 목록에 없는 로컬 커리어(로컬만 삭제, 서버 호출 없음). */
  toDelete: string[];
  /** MOVE_TO_LINKED·NONE일 때만: 미전송(revision > lastSyncedRevision) 로컬 커리어. */
  toNotifyCommitted: string[];
  /** 선택과 무관: 로컬에 없거나 로컬이 뒤처졌고 미전송분이 없는 서버 커리어(다운로드 대상). */
  toDownload: string[];
  /** KEEP_LINKED_ONLY: 같은 id의 로컬 데이터도 선택한 Google 저장본으로 교체한다. */
  toReplace: string[];
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
      : local
          .filter(
            (career) =>
              career.authority !== 'SERVER_ANNUAL' &&
              career.rulesetVersion !== '3.5.0' &&
              career.revision > career.lastSyncedRevision,
          )
          .map((career) => career.id);

  const toReplace =
    choice === 'KEEP_LINKED_ONLY'
      ? server.filter((summary) => localById.has(summary.id)).map((summary) => summary.id)
      : [];

  const toDownload = server
    .filter((summary) => {
      const localCareer = localById.get(summary.id);
      if (localCareer === undefined) return true;
      if (choice === 'KEEP_LINKED_ONLY') return false;
      const hasUnsent = localCareer.revision > localCareer.lastSyncedRevision;
      if (summary.authority === 'SERVER_ANNUAL')
        return localCareer.revision < summary.revision || localCareer.authority !== 'SERVER_ANNUAL';
      return localCareer.revision < summary.revision && !hasUnsent;
    })
    .map((summary) => summary.id);

  return { toDelete, toNotifyCommitted, toDownload, toReplace };
}

async function fetchAllRemoteCareers(): Promise<ReconcileServerCareer[] | null> {
  const items: ReconcileServerCareer[] = [];
  let cursor: string | undefined;
  for (;;) {
    const result = await listRemoteCareers(cursor);
    if (!result.ok) return null;
    for (const item of result.data.items) {
      items.push({
        id: item.id,
        revision: item.revision,
        ...(item.authority ? { authority: item.authority } : {}),
      });
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
  const intendedOwner = await engine.store.transaction('readonly', (tx) =>
    tx.kv.get<string>('profile:id'),
  );
  const serverCareers = await fetchAllRemoteCareers();
  const ownerUnchanged = async () =>
    (await engine.store.transaction('readonly', (tx) => tx.kv.get<string>('profile:id'))) ===
    intendedOwner;
  if (!(await ownerUnchanged())) return { ok: false, failed: [] };
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
    ...(record.authority ? { authority: record.authority } : {}),
    rulesetVersion: record.rulesetVersion,
  }));

  const plan = planReconciliation(choice, local, serverCareers);

  if (plan.toNotifyCommitted.length > 0) {
    const sync = await getSyncClient();
    for (const careerId of plan.toNotifyCommitted) {
      if (!(await ownerUnchanged())) return { ok: false, failed: [] };
      const load = await engine.client.loadCareer(careerId);
      if (load.ok) sync.notifyCommitted(careerId, load.snapshot);
    }
  }

  const now = new Date().toISOString();
  const profileId = intendedOwner;
  const failed: string[] = [];
  for (const careerId of plan.toReplace) {
    const result = await getRemoteCareer(careerId);
    if (!result.ok) {
      failed.push(careerId);
      continue;
    }
    if (!(await ownerUnchanged())) return { ok: false, failed: [] };
    const imported = await importCareerFromServer(engine.store, result.data, {
      pendingDeleteKey,
      ...(profileId ? { ownerProfileId: profileId, expectedProfileId: profileId } : {}),
      rulesetForVersion: loadRuleset,
      retirementArtifacts: (versions) =>
        loadRetirementArtifacts(versions.rulesetVersion, versions.contentPackVersion),
      now,
      replaceLocal: true,
    });
    if (!imported.ok) failed.push(careerId);
  }
  if (plan.toDownload.length > 0) {
    for (const careerId of plan.toDownload) {
      const result = await getRemoteCareer(careerId);
      if (!result.ok) {
        failed.push(careerId);
        continue;
      }
      if (!(await ownerUnchanged())) return { ok: false, failed: [] };
      const imported = await importCareerFromServer(engine.store, result.data, {
        pendingDeleteKey,
        ...(profileId ? { ownerProfileId: profileId, expectedProfileId: profileId } : {}),
        rulesetForVersion: loadRuleset,
        retirementArtifacts: (versions) =>
          loadRetirementArtifacts(versions.rulesetVersion, versions.contentPackVersion),
        now,
      });
      // CAREER_REVISION_CONFLICT는 이 기기의 미전송 진행을 보호하려는 의도된 건너뛰기라 실패로 세지 않는다.
      if (!imported.ok && imported.error.code !== 'CAREER_REVISION_CONFLICT') {
        failed.push(careerId);
      }
    }
  }

  // Google 저장본의 fetch·검증·import가 하나라도 실패하면 원래 익명 프로필의 로컬 전용
  // 커리어를 남겨 재시도·복구할 수 있게 한다. 모두 준비된 뒤에만 명시한 기기 정리를 적용한다.
  if (failed.length === 0) {
    if (!(await ownerUnchanged())) return { ok: false, failed: [] };
    for (const careerId of plan.toDelete) {
      await engine.client.deleteCareer(careerId);
    }
  }

  // 일부만 실패해도 나머지는 반영됐으니 화면은 갱신한다.
  await queryClient.invalidateQueries();
  return failed.length > 0 ? { ok: false, failed } : { ok: true };
}
import { loadRetirementArtifacts } from '@offside/content';
