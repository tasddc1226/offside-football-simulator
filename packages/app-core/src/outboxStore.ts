// Small synchronous durable producer, independent of the lazy-loaded networking module.
import type { PutCareerSeasonBody, PutRetirementBody } from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import { OUTBOX_KEY } from './achDirty.js';

export type OutboxItem = { revision?: number } & (
  | { kind: 'season'; careerId: string; year: number; body: PutCareerSeasonBody }
  | { kind: 'retirement'; careerId: string; body: PutRetirementBody }
);

let unsaved: OutboxItem[] | null = null;
let lastRevision = 0;
export const loadOutbox = (): OutboxItem[] => unsaved ?? loadKey<OutboxItem[]>(OUTBOX_KEY) ?? [];
export function saveOutbox(items: OutboxItem[]): boolean {
  const saved = saveKey(OUTBOX_KEY, items);
  unsaved = saved ? null : items;
  if (!saved) console.error('[outbox] persistence failed; pending records retained');
  notifyUploadStatus();
  return saved;
}

// ───────── T-11-433 업로드 상태(대기 · 보내는 중 · 완료 · 거절) ─────────
// 화면이 동기로 읽는다(웹은 네트워킹 모듈 outbox.ts를 지연 로드하므로 상태는 여기 둔다). 서버에 묻지 않는다.

/** 서버가 4xx로 거절한 이유(응답의 error.code · details.reason). 옛 저장값엔 없다. */
export type UploadRejection = { status: number; code?: string; reason?: string; at: number };
/** 거절돼 큐에서 뺀 항목. T-11-433 전에는 rejected 없이 항목만 남겼다(그대로 읽는다). */
export type RejectedItem = OutboxItem & { rejected?: UploadRejection };
export const REJECTED_KEY = `${OUTBOX_KEY}:rejected`;
export const loadRejected = (): RejectedItem[] => loadKey<RejectedItem[]>(REJECTED_KEY) ?? [];
export function saveRejected(items: RejectedItem[]): boolean {
  const saved = saveKey(REJECTED_KEY, items);
  notifyUploadStatus();
  return saved;
}

/** 사람에게 보일 거절 사유. 서버 코드(apps/api routes/careers.ts · middleware/bodyGuard.ts)를 묶는다. */
export type RejectReason = 'noSeasons' | 'name' | 'tooLarge' | 'owner' | 'invalid' | 'unknown';
export function rejectReasonOf(r: UploadRejection | undefined): RejectReason {
  if (!r) return 'unknown';
  if (r.code === 'CAREER_OWNER_MISMATCH') return 'owner';
  switch (r.reason) {
    case 'CAREER_NOT_FOUND':
    case 'NO_SEASONS':
      return 'noSeasons';
    case 'PUBLIC_NAME_REJECTED':
      return 'name';
    case 'BODY_TOO_LARGE':
      return 'tooLarge';
  }
  return r.code === 'VALIDATION_FAILED' ? 'invalid' : 'unknown';
}

export type UploadStatus =
  | { state: 'done' }
  | { state: 'pending' }
  | { state: 'sending' }
  | { state: 'rejected'; reason: RejectReason };

let sending: string | null = null;
/** outbox.ts가 한 항목을 보내기 직전·직후에 부른다. */
export function markSending(careerId: string | null): void {
  if (sending === careerId) return;
  sending = careerId;
  notifyUploadStatus();
}

/** 은퇴 커리어의 서버 반영 상태. 큐에 그 커리어 항목(시즌 포함)이 남았으면 대기, 은퇴가 거절돼 빠졌으면 거절, 아니면 완료. */
export function retirementUploadStatus(careerId: string): UploadStatus {
  if (loadOutbox().some((i) => i.careerId === careerId))
    return { state: sending === careerId ? 'sending' : 'pending' };
  const rejected = loadRejected()
    .filter((i) => i.kind === 'retirement' && i.careerId === careerId)
    .pop();
  if (rejected) return { state: 'rejected', reason: rejectReasonOf(rejected.rejected) };
  return { state: 'done' };
}

const statusListeners = new Set<() => void>();
/** 큐 · 거절 기록 · 보내는 중 표시가 바뀔 때 알린다(폴링 없이 화면이 다시 읽게). 해제 함수를 돌려준다. */
export function onUploadStatus(fn: () => void): () => void {
  statusListeners.add(fn);
  return () => void statusListeners.delete(fn);
}
function notifyUploadStatus(): void {
  for (const fn of statusListeners) fn();
}
export function persistUpload(item: OutboxItem): boolean {
  const items = loadOutbox();
  // The synchronous producer and lazy sender may enqueue the same immutable payload.
  const signature = (i: OutboxItem) =>
    JSON.stringify({
      kind: i.kind,
      careerId: i.careerId,
      year: i.kind === 'season' ? i.year : undefined,
      body: i.body,
    });
  if (!items.some((i) => signature(i) === signature(item))) {
    lastRevision = items.reduce(
      (v, i) => Math.max(v, (i.revision ?? 0) + 1),
      Math.max(Date.now(), lastRevision + 1),
    );
    items.push({ ...item, revision: lastRevision });
  }
  return saveOutbox(items);
}
