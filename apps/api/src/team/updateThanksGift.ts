// T-11-664 업데이트 감사 선물(홈 선물 칸, 한 번). 기간 안이면 로그인한 구단주 누구나 받는다. 로그인 확인은 라우트(requireOwner)가 한다.
import { UPDATE_THANKS_GIFT } from '@offside/contracts/owner-team';
import type { Db } from '../db/client.js';

/** 받을 수 있으면 장수, 기간 밖이거나 이미 받았으면 null. 기간 밖이면 DB를 읽지 않는다. */
export async function updateThanksGiftOf(db: Db, profileId: string, now: string) {
  const g = UPDATE_THANKS_GIFT;
  if (now < g.from || now >= g.until) return null;
  const row = await db.$client
    .prepare(`SELECT 1 AS claimed FROM gift_claims WHERE profile_id = ?1 AND gift_id = ?2`)
    .bind(profileId, g.id)
    .first<{ claimed: number }>();
  if (row) return null;
  return { boost: g.boost, scout: g.scout, reroll: g.reroll };
}
