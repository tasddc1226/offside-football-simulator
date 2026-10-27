import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { badgeOf, unreadBadges } from './badge.js';

const NOW = '2026-10-27T03:00:00.000Z';
let ctx: TestD1;
beforeAll(async () => {
  ctx = await createTestD1();
  const db = ctx.env.DB;
  const ids = Array.from({ length: 95 }, (_, i) => `p${i}`);
  const notification = (id: string, profile: string, readAt: string | null, expiresAt: string) =>
    db
      .prepare(
        `INSERT INTO notifications (id, profile_id, source_key, kind, title, body, target_json, created_at, read_at, expires_at)
      VALUES (?, ?, ?, 'team', '제목', '본문', '{}', ?, ?, ?)`,
      )
      .bind(id, profile, id, NOW, readAt, expiresAt);
  await db.batch([
    ...ids.map((id) =>
      db
        .prepare(
          `INSERT INTO profiles (id, settings_json, created_at, last_seen_at) VALUES (?, '{}', ?, ?)`,
        )
        .bind(id, NOW, NOW),
    ),
    notification('n1', 'p0', null, '2026-11-01T00:00:00.000Z'),
    notification('n2', 'p0', null, '2026-11-01T00:00:00.000Z'),
    notification('n3', 'p0', NOW, '2026-11-01T00:00:00.000Z'),
    notification('n4', 'p0', null, '2026-10-01T00:00:00.000Z'),
    notification('n5', 'p94', null, '2026-11-01T00:00:00.000Z'),
  ]);
});
afterAll(async () => {
  await ctx.dispose();
});

describe('unreadBadges', () => {
  it('읽지 않고 만료되지 않은 알림만 프로필마다 센다(바인딩 상한을 넘는 수도 나눠 센다)', async () => {
    const ids = Array.from({ length: 95 }, (_, i) => `p${i}`);
    const counts = await unreadBadges(ctx.env.DB, [...ids, 'p0'], NOW);
    expect(badgeOf(counts, 'p0')).toEqual({ badge: 2 });
    expect(badgeOf(counts, 'p94')).toEqual({ badge: 1 });
    expect(badgeOf(counts, 'p1')).toEqual({ badge: 0 });
  });
  it('세지 못하면 badge를 싣지 않는다', async () => {
    const broken = { batch: () => Promise.reject(new Error('down')), prepare: () => ({}) };
    const counts = await unreadBadges(broken as unknown as D1Database, ['p0'], NOW);
    expect(badgeOf(counts, 'p0')).toEqual({});
  });
});
