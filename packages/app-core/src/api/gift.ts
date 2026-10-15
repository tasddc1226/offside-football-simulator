// T-11-275 홈 선물(오프사이드 컵 배너 아래). 로그인한 구단주가 한 번 받는다. 세션이 없거나 로그인하지 않은 것으로 확인된
// 기기, 이미 받은 기기는 묻지 않는다. 구단주인지 모르는 기기는 한 번 묻고 답(403이면 비로그인)을 구단주 표시로 남긴다.
import type { HomeGiftResponse, OwnerItemsResponse } from '@offside/contracts';
import { HOME_GIFT } from '@offside/contracts/cup';
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { storage } from '@offside/game/storage';
import { apiFetch, hasSessionHint, ownerCachedGet, type ApiResult } from './client.js';
import { GIFT_HINT, ownerHintState, withOwnerHint } from './friendPending.js';

export type HomeGift = NonNullable<HomeGiftResponse['gift']>;

function giftDone() {
  try {
    return storage().getItem(GIFT_HINT) === HOME_GIFT.id;
  } catch {
    return false;
  }
}
function markGiftDone() {
  try {
    storage().setItem(GIFT_HINT, HOME_GIFT.id);
  } catch {
    // 저장소를 못 쓰면 다음에 한 번 더 묻는다(서버가 null을 준다).
  }
}

/** 받을 수 있는 선물. 받을 게 없거나 묻지 않는 기기 · 실패면 null. 홈을 열 때마다 묻지 않게 10분 메모. */
export async function fetchHomeGift(): Promise<HomeGift | null> {
  if (!hasSessionHint() || ownerHintState() === false || giftDone()) return null;
  const r = await withOwnerHint(ownerCachedGet<HomeGiftResponse>('/v1/items/gift', 10 * 60_000));
  if (!r.ok) return null;
  if (!r.data.gift) markGiftDone();
  return r.data.gift;
}

/** 선물 받기. 받았거나 이미 받은 선물(409 GIFT_CLAIMED)이면 이 기기에서 다시 묻지 않는다. key는 한 번의 누름마다 하나. */
export async function claimHomeGift(key: string): Promise<ApiResult<OwnerItemsResponse>> {
  const r = await apiFetch<OwnerItemsResponse>('/v1/items/gift/claim', {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
  });
  if (r.ok || r.error.reason === 'GIFT_CLAIMED') markGiftDone();
  return r;
}
