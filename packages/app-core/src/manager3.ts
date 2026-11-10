// T-11-648 감독 커리어 3(감독 키우기) 웹 · 앱 공용. 커리어는 기기에서 돌고(게임 엔진 manager3, 세이브 ft_mgr3_save),
// 서버는 시작(engine 3) · 후보 이력서 재료 · 포기 · 완료만 맡는다. 감독 화면(지연 청크)만 import한다.
import type {
  ManagerCareer,
  ManagerCareerResponse,
  ManagerPreviewResponse,
  ManagerResult,
} from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import {
  M3_SAVE_KEY,
  managerResult3,
  migrateManager3Save,
  newManager3,
  previewManager3,
  type M3State,
} from '@offside/game/manager3';
import { apiFetch, ownerCachedGet } from './api/client.js';

/** 감독 커리어 3 시작(카드가 감독으로 분류된다). */
export const startManager3 = (careerId: string) =>
  apiFetch<ManagerCareerResponse>('/v1/managers', {
    method: 'POST',
    body: JSON.stringify({ careerId, engine: 3 }),
  });

export type Manager3Preview = ReturnType<typeof previewManager3>;

/** 후보 이력서: 그 카드를 열 때만 부르고, 같은 카드는 10분 동안 메모에서 읽는다. */
export async function fetchManagerPreview(careerId: string) {
  const res = await ownerCachedGet<ManagerPreviewResponse>(
    `/v1/managers/preview/${encodeURIComponent(careerId)}`,
    10 * 60_000,
  );
  return res.ok ? { ok: true as const, preview: previewManager3(res.data.origin) } : res;
}

/** 진행 중 감독 커리어 3의 기기 세이브. 같은 커리어 세이브가 있으면 이어 하고, 아니면 서버 시드로 처음부터 만든다. */
export function loadManager3State(active: ManagerCareer, name: string | null): M3State {
  const saved = migrateManager3Save(loadKey(M3_SAVE_KEY));
  if (saved && saved.id === active.id) return saved;
  const s = newManager3({
    id: active.id,
    careerId: active.careerId,
    seed: active.seed,
    origin: active.origin,
    name,
  });
  saveManager3State(s);
  return s;
}
export const saveManager3State = (s: M3State) => saveKey(M3_SAVE_KEY, s);
export const clearManager3State = () => saveKey(M3_SAVE_KEY, null);

/** 서버에 보낼 감독 카드 결과. 끝나기 전이면 null. */
export function manager3ServerResult(s: M3State): ManagerResult | null {
  return managerResult3(s);
}
