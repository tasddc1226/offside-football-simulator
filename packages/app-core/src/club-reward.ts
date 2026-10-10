// T-11-153 광고 대신 구단 자금으로 받기(웹 · 앱 공용). 앱의 보상형 광고 자리(후보 잠재력 · 시즌 평가 보기 · 자금이 모자란
// 시즌의 강화)에서 로그인한 구단주는 광고와 구단 자금 중 고른다. 웹은 광고가 없어 후보 잠재력 · 강화만 구단 자금으로 받는다.
// 서버는 자금만 받고, 보상은 응답을 받은 뒤 기기의 게임이 준다.
import type { RewardKind, RewardShopResponse } from '@offside/contracts';
import { buyRewardWithFunds, fetchRewardShop, spendBoost } from './api/cup.js';
import { clearApiCache, hasSessionHint } from './api/client.js';
import { fundsText } from './funds.js';
import { gameBoostText as L } from './i18n/ko/gameBoost';

/** 지금 구단 자금으로 받을 수 있는 한 번 — 가격과 확인 문구. */
export interface ClubOffer {
  kind: RewardKind;
  price: number;
  /** 확인 창 본문(가격 · 쓴 뒤 남는 자금). */
  confirm: string;
}

// 구단주가 아니라고(로그인 안 한 익명 프로필) 거절받으면 한동안 다시 묻지 않는다 — 화면에 들어올 때마다 403을 받지 않게.
const DENIED_MS = 10 * 60_000;
let deniedAt = -Infinity;

/** 구단주라면 보상 값을 받는다. 아니거나 못 받으면 null — 구단 자금 버튼을 보이지 않는다. 30초 메모라 여러 자리가 불러도 요청은 하나. */
export async function loadClubShop(): Promise<RewardShopResponse | null> {
  if (!hasSessionHint() || Date.now() - deniedAt < DENIED_MS) return null;
  const r = await fetchRewardShop();
  if (!r.ok && r.error.reason === 'GOOGLE_LOGIN_REQUIRED') deniedAt = Date.now();
  return r.ok ? r.data : null;
}

/** 이 보상을 지금 구단 자금으로 받을 수 있으면 그 값. 팔지 않거나 오늘 상한을 다 썼거나 자금이 모자라면 null. */
export function clubOffer(shop: RewardShopResponse | null, kind: RewardKind): ClubOffer | null {
  const price = shop?.offers[kind].price;
  if (!shop || price == null || shop.balance < price) return null;
  return {
    kind,
    price,
    confirm: L.clubConfirm({ price: fundsText(price), balance: fundsText(shop.balance - price) }),
  };
}

// 한 번의 시도에 멱등 키 하나 — 응답을 못 받아(네트워크) 다시 누르면 같은 키로 보내 두 번 쓰지 않는다.
const keys = new Map<RewardKind, string>();

/**
 * ask(확인 문구)로 묻고, 구단 자금을 쓰고, 성공하면 grant로 보상을 준다. 취소하면 null. 바뀐 값(shop)과 보여 줄
 * 안내(message, 성공이면 '')를 돌려준다. 다시 해도 안 되는 거절(가격이 바뀜 · 상한 · 자금 부족)이면 값을 새로 받는다.
 */
export async function payWithClub(
  offer: ClubOffer,
  ask: (message: string) => boolean | Promise<boolean>,
  grant: () => void,
): Promise<{ shop: RewardShopResponse | null; message: string } | null> {
  if (!(await ask(offer.confirm))) return null;
  const key = keys.get(offer.kind) ?? crypto.randomUUID();
  keys.set(offer.kind, key);
  const r = await buyRewardWithFunds(offer.kind, offer.price, key);
  if (r.ok || !r.error.retryable) keys.delete(offer.kind);
  if (!r.ok) {
    // 거절은 메모를 비우지 않으므로(apiFetch는 성공만 비운다) 직접 비우고 새 값을 받는다.
    if (!r.error.retryable) clearApiCache();
    return {
      shop: r.error.retryable ? null : await loadClubShop(),
      message: r.error.message || L.clubFail,
    };
  }
  grant();
  return { shop: r.data, message: '' };
}

// T-11-174 잠재력 강화권: 같은 멱등 키 규칙으로 서버에서 한 장을 뺀 뒤 grant로 강화한다.
let ticketKey: string | null = null;

/**
 * 강화권 한 장을 쓰고 성공하면 grant. 남은 장수(boost)와 보여 줄 안내(message, 성공이면 '')를 돌려준다. 장수가 없다는
 * 거절(NO_BOOST)이면 boost 0, 다시 시도할 수 있는 실패면 boost null(그대로 둔다).
 */
export async function payWithTicket(
  grant: () => void,
): Promise<{ boost: number | null; message: string }> {
  ticketKey ??= crypto.randomUUID();
  const r = await spendBoost(ticketKey);
  if (r.ok || !r.error.retryable) ticketKey = null;
  if (!r.ok)
    return {
      boost: r.error.reason === 'NO_BOOST' ? 0 : null,
      message: r.error.message || L.ticketFail,
    };
  grant();
  return { boost: r.data.boost, message: '' };
}
