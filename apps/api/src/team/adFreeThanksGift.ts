// T-11-517 광고 제거 구매 감사 선물(홈 선물 칸, 한 번). 광고 제거 서버 구매 기록(iap_ad_free_purchases, 프로필 인덱스)에서
// 기준 시각 전에 산 환불 · 시험이 아닌 구매가 있는 구단주만 받는다. 로그인 확인은 라우트(requireOwner)가 한다.
import { AD_FREE_THANKS_GIFT } from '@offside/contracts/owner-team';
import type { Db } from '../db/client.js';

/** 받을 수 있으면 장수, 이미 받았거나 대상이 아니면 null. */
export async function adFreeThanksGiftOf(db: Db, profileId: string) {
  const g = AD_FREE_THANKS_GIFT;
  const row = await db.$client
    .prepare(
      `SELECT
         EXISTS (SELECT 1 FROM gift_claims WHERE profile_id = ?1 AND gift_id = ?2) AS claimed,
         EXISTS (SELECT 1 FROM iap_ad_free_purchases WHERE profile_id = ?1 AND test = 0
           AND refunded_at IS NULL AND created_at < ?3) AS bought`,
    )
    .bind(profileId, g.id, g.before)
    .first<{ claimed: number; bought: number }>();
  if (!row || row.claimed || !row.bought) return null;
  return { boost: g.boost, scout: g.scout, reroll: g.reroll };
}
