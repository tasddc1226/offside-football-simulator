// ───────── 이어 하지 않은 진행 중 커리어 정리 (웹·앱 공용, T-11-354) ─────────
// 새 선수로 다시 시작하면 지난 커리어는 서버에 진행 중으로 남는다. 설정에서 '찾기'를 눌렀을 때만 세고, 확인을 받으면
// 서버가 '정리함'으로 표시한다(지우지 않음). 이 기기의 진행 중 세이브와 올리지 못한 업로드는 빼 달라고 보낸다.
import type { ClearStaleCareersResponse, StaleCareersResponse } from '@offside/contracts';
import { apiFetch, cachedGet } from './api/client.js';
import { loadOutbox, type OutboxItem } from './outboxStore.js';

/** contracts STALE_CAREER_KEEP_MAX와 같다(zod 없이 쓰려고 숫자로 둔다). */
const KEEP_MAX = 20;
/** 한 번 누를 때 서버를 부르는 최대 횟수(한 번에 500개씩). */
const ROUNDS = 10;

/** 정리에서 뺄 커리어: 이 기기의 진행 중 세이브(은퇴 전) + 올리지 못한 업로드의 커리어. */
export function cleanupKeep(
  G: { cid?: string | undefined; retired?: unknown } | null | undefined,
  outbox: readonly OutboxItem[] = loadOutbox(),
): string[] {
  const ids = new Set<string>();
  if (G?.cid && !G.retired) ids.add(G.cid);
  for (const item of outbox) ids.add(item.careerId);
  return [...ids].slice(0, KEEP_MAX);
}

export type CleanupFind = { kind: 'found'; count: number } | { kind: 'none' } | { kind: 'error' };

const stalePath = (keep: readonly string[]) =>
  `/v1/careers/mine/stale${keep.length ? `?keep=${keep.map(encodeURIComponent).join(',')}` : ''}`;

export async function findStaleCareers(keep: readonly string[]): Promise<CleanupFind> {
  const r = await cachedGet<StaleCareersResponse>(stalePath(keep), 30_000);
  if (!r.ok) return { kind: 'error' };
  return r.data.count > 0 ? { kind: 'found', count: r.data.count } : { kind: 'none' };
}

/** 남은 게 없을 때까지(최대 ROUNDS번) 정리한다. 중간에 실패하면 그때까지 정리한 수와 함께 ok=false. */
export async function clearStaleCareers(
  keep: readonly string[],
): Promise<{ ok: boolean; cleared: number }> {
  let cleared = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const r = await apiFetch<ClearStaleCareersResponse>('/v1/careers/mine/stale/clear', {
      method: 'POST',
      body: JSON.stringify({ keep }),
    });
    if (!r.ok) return { ok: false, cleared };
    cleared += r.data.cleared;
    if (r.data.remaining === 0 || r.data.cleared === 0) break;
  }
  return { ok: true, cleared };
}
