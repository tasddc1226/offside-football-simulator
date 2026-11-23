// T-11-818 멤버십 연속 구독(member_tenure). 구독 줄(memberships)이 바뀔 때마다 그 구단주의 가장 늦은 혜택 끝을 다시 읽어
// 연속 시작(since)을 이어 가거나 새로 시작한다. 서포터 뱃지 단계 · 개월 선물은 여기서 읽는다.
import {
  TENURE_GAP_DAYS,
  supporterTier,
  tenureGiftAt,
  tenureGiftId,
  tenureGiftPrefix,
  tenureMonths,
  TENURE_GIFT_FROM,
  type SupporterTier,
} from '@offside/contracts/membership';
import { and, gt, inArray } from 'drizzle-orm';
import type { Db } from '../client.js';
import { memberTenure } from '../schema.js';

const GAP_MS = TENURE_GAP_DAYS * 86_400_000;

/**
 * 구독 줄을 고친 뒤 부른다. 모든 구독 중 가장 늦은 혜택 끝이
 * - 늘었으면: 지난 혜택 끝에서 TENURE_GAP_DAYS가 지나기 전이면 이어서 세고, 지났으면 지금부터 새로 센다.
 * - 줄었으면(환불 · 취소): 끝만 당긴다(연속 시작은 그대로).
 * 실패해도 구독 자체는 이미 묶였으니 던지지 않는다(다음 알림 · 앱 시작 때 다시 맞춰진다).
 */
export async function noteTenure(db: Db, profileId: string, now: string): Promise<void> {
  try {
    const d1 = db.$client;
    const [maxRow, row] = await d1.batch<{ until: string | null; since?: string }>([
      d1
        .prepare('SELECT max(until) AS until FROM memberships WHERE profile_id = ?')
        .bind(profileId),
      d1.prepare('SELECT since, until FROM member_tenure WHERE profile_id = ?').bind(profileId),
    ]);
    const until = maxRow?.results[0]?.until;
    if (!until) return;
    const prev = row?.results[0] as { since: string; until: string } | undefined;
    if (prev && prev.until === until) return;
    const restart =
      !prev || (until > prev.until && Date.parse(now) > Date.parse(prev.until) + GAP_MS);
    const since = restart ? now : prev.since;
    await d1
      .prepare(
        `INSERT INTO member_tenure (profile_id, since, until, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (profile_id) DO UPDATE SET since = excluded.since, until = excluded.until,
           updated_at = excluded.updated_at`,
      )
      .bind(profileId, since, until, now)
      .run();
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', job: 'member-tenure', error: String(e) }));
  }
}

export type Tenure = { since: string; until: string; months: number; tier: SupporterTier | null };

/** 이 구단주의 연속 구독(구독한 적이 없으면 null). */
export async function tenureOf(db: Db, profileId: string, now: string): Promise<Tenure | null> {
  const row = await db.$client
    .prepare('SELECT since, until FROM member_tenure WHERE profile_id = ?')
    .bind(profileId)
    .first<{ since: string; until: string }>();
  if (!row) return null;
  const months = tenureMonths(row.since, row.until, now);
  return { ...row, months, tier: supporterTier(months) };
}

/** 지금 구독 중인 구단주의 서포터 단계(목록 응답에 붙인다). batch에 넣을 수 있게 쿼리로 돌려준다. */
export const tenuresOf = (db: Db, profileIds: readonly string[], now: string) =>
  db
    .select({
      profileId: memberTenure.profileId,
      since: memberTenure.since,
      until: memberTenure.until,
    })
    .from(memberTenure)
    .where(and(inArray(memberTenure.profileId, [...profileIds]), gt(memberTenure.until, now)));

/** tenuresOf 결과 → 구단주별 서포터 단계. */
export function supporterMap(
  rows: readonly { profileId: string; since: string; until: string }[],
  now: string,
): Map<string, SupporterTier> {
  const out = new Map<string, SupporterTier>();
  for (const r of rows) {
    const t = supporterTier(tenureMonths(r.since, r.until, now));
    if (t) out.set(r.profileId, t);
  }
  return out;
}

/** 여러 구단주의 서포터 단계(빈 목록이면 쿼리하지 않는다). */
export async function supportersOf(db: Db, profileIds: readonly string[], now: string) {
  const ids = [...new Set(profileIds)].filter(Boolean);
  if (!ids.length) return new Map<string, SupporterTier>();
  // D1 바인딩 100개 한도 — 목록 응답은 한 페이지(최대 50명 안팎)라 넘지 않지만 넘으면 나눠 읽는다.
  const rows = [];
  for (let i = 0; i < ids.length; i += 90)
    rows.push(...(await tenuresOf(db, ids.slice(i, i + 90), now)));
  return supporterMap(rows, now);
}

/** 아직 받지 않은 개월 선물(이번 연속 구독의 2개월째부터 지금 개월까지, 오래된 달부터). */
export async function pendingTenureGifts(db: Db, profileId: string, t: Tenure) {
  if (t.months < TENURE_GIFT_FROM) return [];
  const prefix = tenureGiftPrefix(t.since);
  const got = await db.$client
    .prepare(
      'SELECT gift_id FROM gift_claims WHERE profile_id = ? AND gift_id >= ? AND gift_id < ?',
    )
    .bind(profileId, prefix, `${prefix}￿`)
    .all<{ gift_id: string }>();
  const have = new Set(got.results.map((r) => r.gift_id));
  const out: { id: string; months: number; boost: number; scout: number }[] = [];
  for (let m = TENURE_GIFT_FROM; m <= t.months; m++) {
    const id = tenureGiftId(t.since, m);
    const gift = tenureGiftAt(m);
    if (gift && !have.has(id)) out.push({ id, months: m, ...gift });
  }
  return out;
}
