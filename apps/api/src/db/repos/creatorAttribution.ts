import { CREATOR_ATTRIBUTION_DAYS } from '@offside/contracts';
import type { Db } from '../client.js';

// T-11-703 크리에이터 링크로 들어온 프로필 기록(creator_attributions). 문서: docs/operations/web-pay.md.

const DAY_MS = 86_400_000;

/** 링크로 들어온 프로필을 그 크리에이터에 묶는다. 같은 링크면 기간만 새로 시작하고, 다른 링크면 바꾼다. */
export async function attributeCreator(db: Db, profileId: string, trackingId: string, now: string) {
  await db.$client
    .prepare(
      `INSERT INTO creator_attributions (profile_id, tracking_id, attributed_at, created_at)
       SELECT id, ?2, ?3, ?3 FROM profiles WHERE id = ?1 AND deleted_at IS NULL
       ON CONFLICT(profile_id) DO UPDATE SET tracking_id = excluded.tracking_id, attributed_at = excluded.attributed_at`,
    )
    .bind(profileId, trackingId, now)
    .run();
}

/** 기간 안이면 묶인 크리에이터의 tracking_id, 아니면 null. */
export async function creatorTrackingOf(db: Db, profileId: string, now: string) {
  const since = new Date(Date.parse(now) - CREATOR_ATTRIBUTION_DAYS * DAY_MS).toISOString();
  const row = await db.$client
    .prepare(
      'SELECT tracking_id trackingId FROM creator_attributions WHERE profile_id = ? AND attributed_at >= ?',
    )
    .bind(profileId, since)
    .first<{ trackingId: string }>();
  return row?.trackingId ?? null;
}
