// T-11-275 홈 선물(오프사이드 컵 배너 아래). 로그인한 구단주가 한 번 받는다. 세션이 없거나 로그인하지 않은 것으로 확인된
// 기기, 이미 받은 기기는 묻지 않는다. 구단주인지 모르는 기기는 한 번 묻고 답(403이면 비로그인)을 구단주 표시로 남긴다.
// T-11-386 같은 칸에 시즌 업적 보상도 온다 — "받을 게 없다"는 표시는 홈 선물 id · 서비스 시즌마다 남겨, 시즌이 바뀌면
// 한 번 더 묻는다. 홈 선물을 받은 뒤 시즌 업적 보상이 남을 수 있는 시즌(시즌 2)이면 표시를 남기지 않고 다음 조회가
// 남은 선물을 묻는다.
import type { HomeGiftResponse, OwnerItemsResponse } from '@offside/contracts';
import { HOME_GIFT } from '@offside/contracts/cup';
import { ACH_SEASON_GIFT } from '@offside/contracts/owner-team';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { storage } from '@offside/game/storage';
import {
  apiFetch,
  clearApiCache,
  hasSessionHint,
  ownerCachedGet,
  type ApiResult,
} from './client.js';
import { giftText as L } from '../i18n/ko/gift';
import { GIFT_HINT, ownerHintState, withOwnerHint } from './friendPending.js';

export type HomeGift = NonNullable<HomeGiftResponse['gift']>;

const doneMark = () => `${HOME_GIFT.id}:${teamSeasonAt(new Date().toISOString()) ?? 0}`;

function giftDone() {
  try {
    return storage().getItem(GIFT_HINT) === doneMark();
  } catch {
    return false;
  }
}
function markGiftDone() {
  try {
    storage().setItem(GIFT_HINT, doneMark());
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

/**
 * 보이는 선물(id) 받기. key는 한 번의 누름마다 하나. 받으면 뒤에 남을 선물이 없을 때만 다시 묻지 않는다. 이미 받았으면
 * (409 GIFT_CLAIMED) 메모를 비워 다음 조회가 남은 선물을 묻는다.
 */
export async function claimHomeGift(
  id: string,
  key: string,
): Promise<ApiResult<OwnerItemsResponse>> {
  const r = await apiFetch<OwnerItemsResponse>('/v1/items/gift/claim', {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
    body: JSON.stringify({ id }),
  });
  const last =
    id === ACH_SEASON_GIFT.id ||
    teamSeasonAt(new Date().toISOString()) !== ACH_SEASON_GIFT.openSeason;
  if (r.ok && last) markGiftDone();
  else if (!r.ok && r.error.reason === 'GIFT_CLAIMED') clearApiCache();
  return r;
}

/** T-11-386 선물 종류에 맞는 카드 제목 · 설명 · 받은 뒤 토스트. */
export function giftCopy(g: HomeGift) {
  const n = { boost: g.boost, scout: g.scout };
  if (g.kind === 'achSeason') {
    const p = { ...n, season: g.season ?? 1 };
    return { title: L.seasonTitle(p), sub: L.seasonSub(p), done: L.seasonDone(p) };
  }
  return { title: L.title, sub: L.sub(n), done: L.done(n) };
}
