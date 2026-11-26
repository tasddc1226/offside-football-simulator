// T-11-834 크리스마스 이벤트. 홈은 기기 시계로 기간(12/19~1/4 KST) 안일 때만 부르고, 기간 밖이면 서버에 묻지 않는다.
// 세션이 없는 첫 방문자도 묻지 않는다(첫 화면에서 401을 내지 않게). 5분 메모, 받은 뒤에는 메모를 지운다.
import type { XmasClaimResponse, XmasEvent } from '@offside/contracts';
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { xmasPhase } from '@offside/contracts/xmas-dates';
import {
  apiFetch,
  cachedGet,
  hasSessionHint,
  invalidateApiCache,
  type ApiResult,
} from './client.js';

const PATH = '/v1/events/xmas';

/** 홈에 이벤트 카드를 띄울 때인가(기기 시계 기준). preview는 운영자 QA(?xmas=preview). */
export const xmasLocalOpen = (preview = false, nowMs = Date.now()) =>
  preview || xmasPhase(nowMs) === 'open';

/** 이벤트 상태. 기간 밖 · 세션 없음 · 실패 · 서버가 닫았다고 하면 null(카드를 숨긴다). */
export async function fetchXmas(preview = false): Promise<XmasEvent | null> {
  if (!xmasLocalOpen(preview) || !hasSessionHint()) return null;
  const r = await cachedGet<XmasEvent>(preview ? `${PATH}?preview=1` : PATH, 5 * 60_000);
  return r.ok && r.data.phase === 'open' ? r.data : null;
}

/** 양말 하나('sock:start') · 트리 단계 하나('tree:2')를 받는다. key는 한 번의 누름마다 하나. */
export async function claimXmas(
  target: string,
  key: string,
  preview = false,
): Promise<ApiResult<XmasClaimResponse>> {
  const r = await apiFetch<XmasClaimResponse>(`${PATH}/claim${preview ? '?preview=1' : ''}`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
    body: JSON.stringify({ target }),
  });
  invalidateApiCache(PATH);
  return r;
}
