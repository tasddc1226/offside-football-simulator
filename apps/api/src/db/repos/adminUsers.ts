import type { AdminUser, OwnerItem } from '@offside/contracts';
import { cupKo } from '../../cupText.js';
import { eventNotificationStatements } from '../../push/events.js';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { grantItemStatement } from './itemShop.js';

// T-11-263 운영 도구 유저 조회와 아이템 지급·회수. 운영자가 열 때만 읽는다. 문의 대응에 필요한 것을 한 batch로 모은다.

const RECENT_CAREERS = 10;
const PURCHASES_LIMIT = 50;
const FUNDS_PURCHASES_LIMIT = 20;
const GRANTS_LIMIT = 20;
const DEVICES_LIMIT = 5;

/** 프로필 id(prf_…) · 닉네임(대소문자 무시) · 친구 코드로 프로필 id를 찾는다(지운 프로필도 찾는다). */
async function resolveProfileId(db: Db, q: string): Promise<string | null> {
  const row = await db.$client
    .prepare(
      `SELECT id FROM profiles WHERE id = ?1 OR lower(nickname) = lower(?1) OR friend_code = upper(?1) LIMIT 1`,
    )
    .bind(q)
    .first<{ id: string }>();
  return row?.id ?? null;
}

type Row = Record<string, unknown>;
const bool = (v: unknown) => v === 1 || v === true;

export async function adminUser(db: Db, q: string, now: Date): Promise<AdminUser | null> {
  const pid = await resolveProfileId(db, q);
  if (!pid) return null;
  const d1 = db.$client;
  const bind = (sql: string, ...more: unknown[]) => d1.prepare(sql).bind(pid, ...more);
  const nowIso = now.toISOString();
  const [
    profile,
    sessions,
    devices,
    careerSums,
    careers,
    teams,
    cups,
    funds,
    items,
    purchases,
    fundsPurchases,
    grants,
    scout,
  ] = await d1.batch<Row>([
    bind(
      `SELECT id, nickname, friend_code friendCode, title, created_at createdAt, last_seen_at lastSeenAt,
              deleted_at deletedAt, google_sub IS NOT NULL google, apple_sub IS NOT NULL apple,
              toss_anon_key_hash IS NOT NULL toss, recovery_code_issued_at recoveryIssuedAt
         FROM profiles WHERE id = ?1`,
    ),
    bind(
      `SELECT channel, sum(revoked_at IS NULL AND expires_at > ?2) active, max(last_seen_at) lastSeenAt
         FROM sessions WHERE profile_id = ?1 GROUP BY channel ORDER BY lastSeenAt DESC`,
      nowIso,
    ),
    bind(
      `SELECT platform, app_version appVersion, updated_at updatedAt FROM push_devices
        WHERE profile_id = ?1 ORDER BY updated_at DESC LIMIT ?2`,
      DEVICES_LIMIT,
    ),
    bind(
      `SELECT count(*) total, coalesce(sum(status = 'active'), 0) active, coalesce(sum(status = 'retired'), 0) retired
         FROM careers WHERE profile_id = ?1`,
    ),
    bind(
      `SELECT id, pos, status, created_at createdAt, retired_at retiredAt, peak, legend_score legendScore, hidden
         FROM careers WHERE profile_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
      RECENT_CAREERS,
    ),
    bind(
      `SELECT season, name, ovr, filled, rating, wins, draws, losses FROM owner_teams
        WHERE profile_id = ?1 ORDER BY season DESC`,
    ),
    bind(
      `SELECT cup_id cupId, name team, status, stage, rewarded_at rewardedAt FROM cup_entries
        WHERE profile_id = ?1 ORDER BY created_at DESC`,
    ),
    bind(`SELECT balance FROM owner_funds WHERE profile_id = ?1`),
    bind(`SELECT item, qty FROM owner_items WHERE profile_id = ?1`),
    bind(
      `SELECT store, product_id productId, item, qty, test, created_at createdAt, refunded_at refundedAt,
              revoked_qty revokedQty FROM iap_purchases WHERE profile_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
      PURCHASES_LIMIT,
    ),
    bind(
      `SELECT item, qty, price, created_at createdAt FROM owner_item_purchases
        WHERE profile_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
      FUNDS_PURCHASES_LIMIT,
    ),
    bind(
      `SELECT payload_json payload, created_at createdAt FROM audit_log
        WHERE profile_id = ?1 AND kind = 'ITEM_GRANTED' ORDER BY created_at DESC LIMIT ?2`,
      GRANTS_LIMIT,
    ),
    bind(
      `SELECT coalesce(sp.used, 0) used, coalesce(sp.streak, 0) streak, coalesce(sp.elites, 0) elites
         FROM (SELECT 1) LEFT JOIN scout_pity sp ON sp.profile_id = ?1`,
    ),
  ]);
  const p = profile!.results[0];
  if (!p) return null;
  return {
    generatedAt: nowIso,
    profile: {
      ...(p as Omit<AdminUser['profile'], 'google' | 'apple' | 'toss'>),
      google: bool(p.google),
      apple: bool(p.apple),
      toss: bool(p.toss),
    },
    sessions: sessions!.results as AdminUser['sessions'],
    devices: devices!.results as AdminUser['devices'],
    careers: {
      ...(careerSums!.results[0] as { total: number; active: number; retired: number }),
      recent: careers!.results.map((c) => ({
        ...(c as Omit<AdminUser['careers']['recent'][number], 'hidden'>),
        hidden: bool(c.hidden),
      })),
    },
    teams: teams!.results as AdminUser['teams'],
    cups: cups!.results as AdminUser['cups'],
    funds: (funds!.results[0]?.balance as number | undefined) ?? null,
    items: Object.fromEntries(items!.results.map((r) => [r.item as string, r.qty as number])),
    purchases: purchases!.results.map((r) => ({
      ...(r as Omit<AdminUser['purchases'][number], 'test'>),
      test: bool(r.test),
    })),
    fundsPurchases: fundsPurchases!.results as AdminUser['fundsPurchases'],
    grants: grants!.results.map((r) => {
      const g = JSON.parse(r.payload as string) as {
        item: string;
        delta: number;
        reason: string;
        by: string;
      };
      return {
        item: g.item,
        delta: g.delta,
        reason: g.reason,
        by: g.by,
        createdAt: r.createdAt as string,
      };
    }),
    scout: scout!.results[0] as AdminUser['scout'],
  };
}

const GRANT_BODY: Record<OwnerItem, 'grantReroll' | 'grantBoost' | 'grantScout' | 'grantRename'> = {
  reroll: 'grantReroll',
  boost: 'grantBoost',
  scout: 'grantScout',
  rename: 'grantRename',
};

/**
 * 아이템 지급(delta > 0)·회수(delta < 0). 회수는 가진 장수까지만(모자라면 아무것도 바꾸지 않는다). 바뀌었을 때만 감사 기록
 * (ITEM_GRANTED, profile_id = 받는 사람)을 남기고, 지급이면서 notify면 알림·푸시를 보낸다. 한 batch(트랜잭션).
 * 결과: 바뀐 뒤 장수, 프로필이 없으면 'missing', 회수할 장수가 모자라면 'short'.
 */
export async function grantOwnerItem(
  db: Db,
  input: { profileId: string; item: OwnerItem; delta: number; reason: string; notify: boolean },
  adminId: string,
  now: string,
): Promise<number | 'missing' | 'short'> {
  const d1 = db.$client;
  const { profileId, item, delta } = input;
  const alive = await d1
    .prepare(`SELECT 1 ok FROM profiles WHERE id = ? AND deleted_at IS NULL`)
    .bind(profileId)
    .first<{ ok: number }>();
  if (!alive) return 'missing';
  const change =
    delta > 0
      ? grantItemStatement(d1, profileId, item, delta, now, { sql: '1' })
      : d1
          .prepare(
            `UPDATE owner_items SET qty = qty + ?, updated_at = ? WHERE profile_id = ? AND item = ? AND qty + ? >= 0`,
          )
          .bind(delta, now, profileId, item, delta);
  const payload = JSON.stringify({ item, delta, reason: input.reason, by: adminId });
  const stmts: D1PreparedStatement[] = [
    change,
    d1
      .prepare(
        `INSERT INTO audit_log (id, kind, profile_id, payload_json, created_at)
         SELECT ?, 'ITEM_GRANTED', ?, ?, ? WHERE changes() > 0`,
      )
      .bind(newId('aud'), profileId, payload, now),
  ];
  if (delta > 0 && input.notify)
    stmts.push(
      ...eventNotificationStatements(d1, {
        profileId,
        // 같은 사람에게 여러 번 보내도 알림마다 따로 남는다.
        sourceKey: `admin-grant:${crypto.randomUUID()}`,
        now,
        content: {
          kind: 'team',
          title: cupKo('grantTitle'),
          body: cupKo(GRANT_BODY[item], { n: delta }),
          target: { type: 'screen', screen: 'home' },
        },
      }),
    );
  const results = await d1.batch(stmts);
  if (!results[0]!.meta.changes) return 'short';
  const row = await d1
    .prepare(`SELECT qty FROM owner_items WHERE profile_id = ? AND item = ?`)
    .bind(profileId, item)
    .first<{ qty: number }>();
  return row?.qty ?? 0;
}
