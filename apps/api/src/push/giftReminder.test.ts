import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_GIFT } from '@offside/contracts/cup';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie, issueGoogleCookie } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';
import { queueGiftReminders } from './giftReminder.js';
import { runPersonalPush } from './personal.js';
import { pushText } from './text.js';
import { giftReminderText } from '../i18n/ko/giftReminder.js';

// T-11-388 홈 선물 안내 푸시(일회성).
const NOW = Date.parse('2026-10-19T03:05:00.000Z'); // KST 10-19 12:05
let ctx: TestD1;
let owner: Awaited<ReturnType<typeof issueGoogleCookie>>;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ctx = await createTestD1();
  owner = await issueGoogleCookie(ctx);
  await addAppPushDevice(ctx, owner.profileId);
  Object.assign(ctx.env, {
    ENVIRONMENT: 'production',
    PERSONAL_PUSH_ENABLED: '1',
    GIFT_REMINDER_ENABLED: '1',
  });
});
afterEach(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});

const rows = async (table: string) =>
  (await ctx.env.DB.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()).results;
const claimed = (profileId: string) =>
  ctx.env.DB.prepare(
    `INSERT INTO gift_claims (profile_id, gift_id, claim_id, claimed_at) VALUES (?, ?, 'claim', ?)`,
  )
    .bind(profileId, HOME_GIFT.id, new Date(NOW).toISOString())
    .run();
const transport = () =>
  vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    Response.json({
      data: JSON.parse(String(init?.body)).map((_: unknown, i: number) => ({
        status: 'ok',
        id: `ticket_${i}`,
      })),
    }),
  );

describe('T-11-388 홈 선물 안내 푸시', () => {
  it('선물을 받지 않은 로그인한 구단주에게 정한 날 12시대 한 번 쌓고, 다시 돌아도 하나다', async () => {
    expect(await queueGiftReminders(ctx.env, NOW)).toEqual({ created: 1 });
    expect(await queueGiftReminders(ctx.env, NOW + 5 * 60_000)).toEqual({ created: 0 });
    const [n] = await rows('notifications');
    expect(n).toMatchObject({
      profile_id: owner.profileId,
      source_key: `gift-reminder:${HOME_GIFT.id}:${owner.profileId}`,
      kind: 'return',
      title: giftReminderText.title,
      body: giftReminderText.body,
      target_json: '{"type":"screen","screen":"home"}',
    });
    const deliveries = await rows('push_deliveries');
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ expires_at: '2026-10-19T06:00:00.000Z' });

    const send = transport();
    await runPersonalPush(ctx.env, NOW, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(send.mock.calls[0]![1]!.body))[0]).toMatchObject({
      title: giftReminderText.title,
      body: giftReminderText.body,
    });
  });

  it('받았거나 · 로그인하지 않았거나 · 정한 날 12시대가 아니거나 · 꺼져 있으면 쌓지 않는다', async () => {
    await claimed(owner.profileId);
    const guest = await issueCookie(ctx);
    await addAppPushDevice(ctx, guest.profileId);
    expect(await queueGiftReminders(ctx.env, NOW)).toEqual({ created: 0 });
    await ctx.env.DB.prepare('DELETE FROM gift_claims').run();
    expect(await queueGiftReminders(ctx.env, NOW + 3600_000)).toEqual({ created: 0 });
    expect(await queueGiftReminders(ctx.env, NOW + 86400_000)).toEqual({ created: 0 });
    expect(await queueGiftReminders({ ...ctx.env, GIFT_REMINDER_ENABLED: '0' }, NOW)).toEqual({
      created: 0,
    });
    expect(await rows('notifications')).toEqual([]);
  });

  it('앱 기기가 14일 넘게 갱신되지 않았으면 보내지 않는다', async () => {
    await ctx.env.DB.prepare('UPDATE push_devices SET updated_at = ?')
      .bind(new Date(NOW - 15 * 86400_000).toISOString())
      .run();
    expect(await queueGiftReminders(ctx.env, NOW)).toEqual({ created: 0 });
  });

  it('쌓은 뒤 보내기 전에 선물을 받았으면 보내지 않는다', async () => {
    await queueGiftReminders(ctx.env, NOW);
    await claimed(owner.profileId);
    const send = transport();
    await runPersonalPush(ctx.env, NOW, send);
    expect(send).not.toHaveBeenCalled();
  });

  it('알림함은 요청 언어로 보인다', () => {
    expect(pushText(giftReminderText.title, 'en')).toBe('Your owner gift is waiting');
    expect(pushText(giftReminderText.body, 'ja')).toBe(
      `ホームでポテンシャル強化券${HOME_GIFT.boost}枚とプレミアムスカウト券${HOME_GIFT.scout}枚を受け取りましょう。`,
    );
  });
});
