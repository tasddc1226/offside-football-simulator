import {
  OwnerItemsResponseSchema,
  SeasonPassClaimResponseSchema,
  SeasonPassResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { applySeasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../db/client.js';
import { seasonPasses } from '../db/schema.js';
import { handleAppleNotification } from '../iap/refunds.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

// Apple 서명 확인 자체는 iap/apple.test.ts가 본다. 여기서는 확인 결과를 정해 두고 패스 규칙만 본다.
const appleTx = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const appleNote = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('../iap/apple.js', async (orig) => ({
  ...(await orig<typeof import('../iap/apple.js')>()),
  verifyAppleTransaction: async () => appleTx.current,
  verifyAppleNotification: async () => appleNote.current,
}));

const PassRes = successEnvelope(SeasonPassResponseSchema);
const ClaimRes = successEnvelope(SeasonPassClaimResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const PASS = 'com.offsidelab.app.season_pass';
const S2 = '2026-10-30T15:00:00.000Z';
const NOW = '2026-11-02T00:00:00.000Z';

describe('T-11-511 시즌 패스', () => {
  let ctx: TestD1;
  let seq = 0;
  beforeEach(async () => {
    ctx = await createTestD1();
    appleTx.current = null;
    appleNote.current = null;
    await saveSeasonSchedule(ctx.env.DB, [
      { id: 1, startsAt: '2026-10-05T15:00:00.000Z', endsAt: S2, retireAt: 45 },
      { id: 2, startsAt: S2, endsAt: null, retireAt: 46 },
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(async () => {
    vi.useRealTimers();
    applySeasonSchedule([]);
    forgetSeasonSchedule();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const state = async (cookie: string) =>
    PassRes.parse(await (await call('GET', '/v1/season-pass', { cookie })).json()).data;
  const buy = (cookie: string) =>
    call('POST', '/v1/season-pass/iap', { cookie, body: { store: 'apple', token: 'jws' } });
  const claim = (cookie: string, season: number) =>
    call('POST', '/v1/season-pass/claim', {
      cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { season },
    });
  const items = async (cookie: string) =>
    ItemsRes.parse(await (await call('GET', '/v1/items', { cookie })).json()).data;
  const appleFor = (profileId: string, id: string) => ({
    transactionId: id,
    bundleId: 'com.offsidelab.app',
    productId: PASS,
    type: 'Consumable',
    environment: 'Sandbox',
    appAccountToken: profileId.replace(/^prf_/, ''),
  });
  /** 그 시즌 선수 n명을 날짜 하루에 은퇴시킨다(나이 age). */
  const retire = async (
    profileId: string,
    n: number,
    opts: { day?: string; age?: number; season?: number } = {},
  ) => {
    const at = `${opts.day ?? '2026-11-01'}T03:00:00.000Z`;
    for (let i = 0; i < n; i++)
      await ctx.env.DB.prepare(
        `INSERT INTO careers(id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at,
           retired_at, retire_age, service_season)
         VALUES (?, ?, 'FW', 'right', 'late', 'star', 2026, 'retired', 'test', ?, ?, ?, ?, ?)`,
      )
        .bind(`c${++seq}`, profileId, at, at, at, opts.age ?? 36, opts.season ?? 2)
        .run();
  };

  it('로그인하지 않은 프로필은 패스를 보지 못한다', async () => {
    const guest = await issueCookie(ctx);
    expect((await call('GET', '/v1/season-pass', { cookie: guest.cookie })).status).toBe(403);
  });

  it('사지 않아도 지금 시즌 진행도를 보여 주고, 판매 스위치가 꺼져 있으면 팔지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    // 35세 미만 은퇴 · 다른 시즌은 세지 않는다.
    await retire(me.profileId, 3);
    await retire(me.profileId, 2, { age: 30 });
    await retire(me.profileId, 4, { season: 1 });
    expect(await state(me.cookie)).toEqual({
      onSale: false,
      stores: [],
      seasons: [{ season: 2, owned: false, progress: 3, tier: 4, claimed: 0 }],
    });
    ctx.env.SEASON_PASS_ENABLED = '1';
    expect(await state(me.cookie)).toMatchObject({
      onSale: true,
      stores: ['apple'],
      account: me.profileId.replace(/^prf_/, ''),
    });
  });

  it('시즌 1에는 스위치가 켜져 있어도 팔지 않고, 시즌 2 패스를 보여 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    ctx.env.SEASON_PASS_ENABLED = '1';
    vi.setSystemTime(new Date('2026-10-28T00:00:00.000Z'));
    expect(await state(me.cookie)).toEqual({
      onSale: false,
      stores: [],
      seasons: [{ season: 2, owned: false, progress: 0, tier: 1, claimed: 0 }],
    });
  });

  it('하루에 세는 은퇴는 dailyCap까지다', async () => {
    const me = await issueGoogleCookie(ctx);
    await retire(me.profileId, 23, { day: '2026-10-31' });
    await retire(me.profileId, 2, { day: '2026-11-01' });
    expect((await state(me.cookie)).seasons[0]).toMatchObject({ progress: 22, tier: 10 });
  });

  it('산 거래로 패스를 열고, 열린 단계를 한꺼번에 받으며 다시 눌러도 두 번 받지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    await retire(me.profileId, 5);
    // 패스가 없으면 받을 수 없다.
    expect((await claim(me.cookie, 2)).status).toBe(404);
    appleTx.current = appleFor(me.profileId, '3000000001');
    const bought = PassRes.parse(await (await buy(me.cookie)).json()).data;
    expect(bought.seasons[0]).toEqual({ season: 2, owned: true, progress: 5, tier: 5, claimed: 0 });
    // 같은 거래 재전송은 같은 결과다.
    expect(PassRes.parse(await (await buy(me.cookie)).json()).data).toEqual(bought);
    expect(await ctx.db.select().from(seasonPasses)).toHaveLength(1);

    const first = ClaimRes.parse(await (await claim(me.cookie, 2)).json()).data;
    // 1~5단계: 사면 바로(스카우트 2 · 강화 10 · 리롤 10) + 리롤 5 + 강화 3 + 리롤 5 · 스카우트 1 + 강화 5.
    expect(first.granted).toEqual({ reroll: 20, boost: 18, scout: 3, rename: 0 });
    expect(first.pass.seasons[0]).toMatchObject({ tier: 5, claimed: 5 });
    const again = ClaimRes.parse(await (await claim(me.cookie, 2)).json()).data;
    expect(again.granted).toEqual({ reroll: 0, boost: 0, scout: 0, rename: 0 });
    expect(await items(me.cookie)).toMatchObject({ reroll: 20, boost: 18, scout: 3 });

    // 더 은퇴시키면 남은 단계만 받는다(6~8단계 = 리롤 6 · 스카우트 1 + 강화 5 · 이름 변경 1 + 리롤 7 · 스카우트 1).
    await retire(me.profileId, 7);
    const next = ClaimRes.parse(await (await claim(me.cookie, 2)).json()).data;
    expect(next.granted).toEqual({ reroll: 13, boost: 5, scout: 2, rename: 1 });
  });

  it('같은 시즌에 두 번 사면 다음 시즌 패스가 되고, 다른 구단주의 거래는 거절한다', async () => {
    const me = await issueGoogleCookie(ctx);
    appleTx.current = appleFor(me.profileId, '3000000001');
    await buy(me.cookie);
    appleTx.current = appleFor(me.profileId, '3000000002');
    const two = PassRes.parse(await (await buy(me.cookie)).json()).data;
    expect(two.seasons.map((s) => [s.season, s.owned])).toEqual([
      [2, true],
      [3, true],
    ]);
    const other = await issueGoogleCookie(ctx);
    expect((await buy(other.cookie)).status).toBe(409);
  });

  it('지난 시즌 패스에 받지 않은 단계가 남아 있으면 계속 보이고 받을 수 있다', async () => {
    const me = await issueGoogleCookie(ctx);
    await ctx.db.insert(seasonPasses).values({
      profileId: me.profileId,
      season: 1,
      store: 'apple',
      transactionId: '2999',
      createdAt: '2026-10-20T00:00:00.000Z',
    });
    await retire(me.profileId, 2, { season: 1 });
    const seasons = (await state(me.cookie)).seasons;
    expect(seasons.map((s) => [s.season, s.tier, s.claimed])).toEqual([
      [2, 1, 0],
      [1, 3, 0],
    ]);
    const got = ClaimRes.parse(await (await claim(me.cookie, 1)).json()).data;
    expect(got.granted).toEqual({ reroll: 15, boost: 13, scout: 2, rename: 0 });
    expect(got.pass.seasons.map((s) => s.season)).toEqual([2]);
  });

  it('환불되면 패스를 닫고 그 패스로 받은 아이템을 가진 만큼 회수한다', async () => {
    const me = await issueGoogleCookie(ctx);
    await retire(me.profileId, 5);
    appleTx.current = appleFor(me.profileId, '3000000009');
    await buy(me.cookie);
    await claim(me.cookie, 2);
    // 리롤 2장은 이미 썼다.
    await ctx.env.DB.prepare(
      `UPDATE owner_items SET qty = qty - 2 WHERE profile_id = ? AND item = 'reroll'`,
    )
      .bind(me.profileId)
      .run();
    appleNote.current = {
      notificationType: 'REFUND',
      data: { bundleId: 'com.offsidelab.app', signedTransactionInfo: 'jws' },
    };
    const r = await handleAppleNotification(ctx.env, createDb(ctx.env.DB), 'payload', NOW);
    expect(r).toBe('revoked');
    expect(await items(me.cookie)).toMatchObject({ reroll: 0, boost: 0 });
    expect((await state(me.cookie)).seasons[0]).toMatchObject({ owned: false });
    expect((await claim(me.cookie, 2)).status).toBe(404);
    // 같은 알림이 다시 와도 한 번만 처리한다.
    expect(await handleAppleNotification(ctx.env, createDb(ctx.env.DB), 'payload', NOW)).toBe(
      'revoked',
    );
  });
});
