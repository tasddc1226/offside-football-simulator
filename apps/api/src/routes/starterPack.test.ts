import {
  OwnerItemsResponseSchema,
  StarterPackIapResponseSchema,
  StarterPackResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../db/client.js';
import { starterControl } from '../db/repos/starterPack.js';
import { handleAppleNotification } from '../iap/refunds.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

// Apple 서명 확인 자체는 iap/apple.test.ts가 본다. 여기서는 확인 결과를 정해 두고 첫 구매 묶음 규칙만 본다.
const appleTx = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const appleNote = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('../iap/apple.js', async (orig) => ({
  ...(await orig<typeof import('../iap/apple.js')>()),
  verifyAppleTransaction: async () => appleTx.current,
  verifyAppleNotification: async () => appleNote.current,
}));

const PackRes = successEnvelope(StarterPackResponseSchema);
const BuyRes = successEnvelope(StarterPackIapResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const STARTER = 'com.offsidelab.app.starter_v1';
const NOW = '2026-11-20T00:00:00.000Z';

describe('T-11-770d 첫 구매 묶음', () => {
  let ctx: TestD1;
  let seq = 0;
  beforeEach(async () => {
    ctx = await createTestD1();
    appleTx.current = null;
    appleNote.current = null;
    ctx.env.STARTER_PACK_ENABLED = '1';
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const state = async (cookie: string) =>
    PackRes.parse(await (await call('GET', '/v1/starter-pack', { cookie })).json()).data;
  const buy = (cookie: string) =>
    call('POST', '/v1/starter-pack/iap', { cookie, body: { store: 'apple', token: 'jws' } });
  const items = async (cookie: string) =>
    ItemsRes.parse(await (await call('GET', '/v1/items', { cookie })).json()).data;
  const appleFor = (profileId: string, id: string, productId = STARTER) => ({
    transactionId: id,
    bundleId: 'com.offsidelab.app',
    productId,
    type: 'Consumable',
    environment: 'Production',
    appAccountToken: profileId.replace(/^prf_/, ''),
  });
  const retire = async (profileId: string, age = 36) => {
    await ctx.env.DB.prepare(
      `INSERT INTO careers(id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at,
         retired_at, retire_age, service_season)
       VALUES (?, ?, 'FW', 'right', 'late', 'star', 2026, 'retired', 'test', ?, ?, ?, ?, 2)`,
    )
      .bind(`c${++seq}`, profileId, NOW, NOW, NOW, age)
      .run();
  };
  /** 대조군이 아닌(또는 대조군인) 로그인 구단주를 만든다. 군은 프로필 id로 정해져 맞는 쪽이 나올 때까지 새로 만든다. */
  const owner = async (control = false) => {
    for (let i = 0; i < 200; i++) {
      const me = await issueGoogleCookie(ctx);
      if ((await starterControl(me.profileId)) === control) return me;
    }
    throw new Error('군을 맞추지 못했다');
  };

  it('로그인하지 않은 프로필은 묶음을 보지 못한다', async () => {
    const guest = await issueCookie(ctx);
    expect((await call('GET', '/v1/starter-pack', { cookie: guest.cookie })).status).toBe(403);
  });

  it('끝까지 뛴 은퇴 선수가 있고 결제 이력이 없으면 살 수 있다', async () => {
    const me = await owner();
    expect(await state(me.cookie)).toMatchObject({ state: 'ineligible', stores: [] });
    // 35세 미만 은퇴는 세지 않는다.
    await retire(me.profileId, 30);
    expect((await state(me.cookie)).state).toBe('ineligible');
    await retire(me.profileId);
    expect(await state(me.cookie)).toEqual({
      state: 'eligible',
      version: 'v1',
      items: { reroll: 5, boost: 5, scout: 1, rename: 0 },
      stores: ['apple'],
      account: me.profileId.replace(/^prf_/, ''),
    });
  });

  it('판매 스위치가 꺼져 있으면 팔지 않는다', async () => {
    const me = await owner();
    await retire(me.profileId);
    ctx.env.STARTER_PACK_ENABLED = '0';
    expect(await state(me.cookie)).toMatchObject({ state: 'off', stores: [] });
  });

  it('대조군에게는 보이지 않는다', async () => {
    const me = await owner(true);
    await retire(me.profileId);
    expect((await state(me.cookie)).state).toBe('ineligible');
  });

  it.each([
    [
      '아이템',
      `INSERT INTO iap_purchases (store, transaction_id, profile_id, product_id, item, qty, test, created_at)
       VALUES ('apple', 't1', ?, 'com.offsidelab.app.boost_3', 'boost', 3, 0, ?)`,
    ],
    [
      '환불한 아이템',
      `INSERT INTO iap_purchases (store, transaction_id, profile_id, product_id, item, qty, test, created_at, refunded_at)
       VALUES ('apple', 't1', ?1, 'com.offsidelab.app.boost_3', 'boost', 3, 0, ?2, ?2)`,
    ],
    [
      '시즌 패스',
      `INSERT INTO season_passes (profile_id, season, store, transaction_id, test, claimed, created_at)
       VALUES (?, 2, 'apple', 't1', 0, 0, ?)`,
    ],
    [
      '멤버십',
      `INSERT INTO memberships (store, chain_id, profile_id, until, test, verified_at, created_at)
       VALUES ('apple', 'c1', ?1, ?2, 0, ?2, ?2)`,
    ],
    [
      '웹 결제',
      `INSERT INTO web_pay_orders (order_id, profile_id, product_id, xsolla_order_id, status, test, created_at)
       VALUES ('o1', ?, 'com.offsidelab.app.boost_3', 'x1', 'PAID', 0, ?)`,
    ],
    [
      '광고 제거',
      `INSERT INTO iap_ad_free_purchases (store, transaction_id, profile_id, product_id, test, created_at)
       VALUES ('apple', 't1', ?, 'com.offsidelab.app.remove_ads', 0, ?)`,
    ],
  ])('%s 결제 이력이 있으면 대상이 아니다', async (_name, sql) => {
    const me = await owner();
    await retire(me.profileId);
    expect((await state(me.cookie)).state).toBe('eligible');
    await ctx.env.DB.prepare(sql).bind(me.profileId, NOW).run();
    expect((await state(me.cookie)).state).toBe('ineligible');
  });

  it('시험 결제 · 결제창만 연 웹 주문은 결제 이력으로 세지 않는다', async () => {
    const me = await owner();
    await retire(me.profileId);
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `INSERT INTO iap_purchases (store, transaction_id, profile_id, product_id, item, qty, test, created_at)
         VALUES ('apple', 't1', ?, 'com.offsidelab.app.boost_3', 'boost', 3, 1, ?)`,
      ).bind(me.profileId, NOW),
      ctx.env.DB.prepare(
        `INSERT INTO web_pay_orders (order_id, profile_id, product_id, xsolla_order_id, status, test, created_at)
         VALUES ('o1', ?, 'com.offsidelab.app.boost_3', 'x1', 'READY', 0, ?)`,
      ).bind(me.profileId, NOW),
    ]);
    expect((await state(me.cookie)).state).toBe('eligible');
  });

  it('사면 세 가지 아이템을 한 번에 받고, 같은 거래를 다시 보내도 한 번만 받는다', async () => {
    const me = await owner();
    await retire(me.profileId);
    appleTx.current = appleFor(me.profileId, 'tx1');
    const first = BuyRes.parse(await (await buy(me.cookie)).json()).data;
    expect(first.have).toEqual({ reroll: 5, boost: 5, scout: 1, rename: 0 });
    expect(first.pack.state).toBe('owned');
    const again = await buy(me.cookie);
    expect(again.status).toBe(200);
    expect(BuyRes.parse(await again.json()).data.have).toEqual(first.have);
    expect(await items(me.cookie)).toMatchObject({ reroll: 5, boost: 5, scout: 1 });
    expect((await state(me.cookie)).state).toBe('owned');
    const row = await ctx.env.DB.prepare(`SELECT version, test FROM starter_packs`).all();
    expect(row.results).toEqual([{ version: 'v1', test: 0 }]);
  });

  it('같은 거래를 동시에 보내도 한 번만 준다', async () => {
    const me = await owner();
    await retire(me.profileId);
    appleTx.current = appleFor(me.profileId, 'tx1');
    const rs = await Promise.all([buy(me.cookie), buy(me.cookie), buy(me.cookie)]);
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await items(me.cookie)).toMatchObject({ reroll: 5, boost: 5, scout: 1 });
  });

  it('스토어가 서로 다른 유료 거래를 둘 승인했으면 둘 다 주고, 자격은 다시 열리지 않는다', async () => {
    const me = await owner();
    await retire(me.profileId);
    appleTx.current = appleFor(me.profileId, 'tx1');
    await buy(me.cookie);
    appleTx.current = appleFor(me.profileId, 'tx2');
    expect((await buy(me.cookie)).status).toBe(200);
    expect(await items(me.cookie)).toMatchObject({ reroll: 10, boost: 10, scout: 2 });
    expect((await state(me.cookie)).state).toBe('owned');
  });

  it('판매를 닫은 뒤에도 승인된 거래는 준다', async () => {
    const me = await owner();
    await retire(me.profileId);
    ctx.env.STARTER_PACK_ENABLED = '0';
    appleTx.current = appleFor(me.profileId, 'tx1');
    expect((await buy(me.cookie)).status).toBe(200);
    expect(await items(me.cookie)).toMatchObject({ scout: 1 });
  });

  it('다른 구단주의 거래 · 다른 상품의 거래는 받지 않는다', async () => {
    const me = await owner();
    const other = await owner();
    appleTx.current = appleFor(other.profileId, 'tx1');
    expect((await buy(me.cookie)).status).toBe(409);
    appleTx.current = appleFor(me.profileId, 'tx2', 'com.offsidelab.app.boost_3');
    expect((await buy(me.cookie)).status).toBe(409);
    expect(await items(me.cookie)).toMatchObject({ reroll: 0, boost: 0, scout: 0 });
  });

  it('옛 아이템 구매 길(POST /v1/items/iap)은 묶음 상품을 받지 않는다', async () => {
    const me = await owner();
    const r = await call('POST', '/v1/items/iap', {
      cookie: me.cookie,
      body: { store: 'apple', productId: STARTER, token: 'jws' },
    });
    expect(r.status).toBe(400);
  });

  it('환불되면 가진 만큼만 아이템별로 회수하고, 같은 알림이 다시 와도 한 번만 처리한다', async () => {
    const me = await owner();
    await retire(me.profileId);
    appleTx.current = appleFor(me.profileId, 'tx1');
    await buy(me.cookie);
    // 강화권 3장을 쓴 뒤라 2장만 남았고, 다른 길로 받은 리롤권이 2장 더 있다.
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE owner_items SET qty = 2 WHERE profile_id = ? AND item = 'boost'`,
      ).bind(me.profileId),
      ctx.env.DB.prepare(
        `UPDATE owner_items SET qty = 7 WHERE profile_id = ? AND item = 'reroll'`,
      ).bind(me.profileId),
    ]);
    appleNote.current = {
      notificationType: 'REFUND',
      data: { bundleId: 'com.offsidelab.app', signedTransactionInfo: 'jws' },
    };
    expect(await handleAppleNotification(ctx.env, createDb(ctx.env.DB), 'payload', NOW)).toBe(
      'revoked',
    );
    expect(await items(me.cookie)).toMatchObject({ reroll: 2, boost: 0, scout: 0 });
    const row = await ctx.env.DB.prepare(
      `SELECT revoked_json AS revoked, refunded_at AS at FROM starter_packs`,
    ).first<{ revoked: string; at: string }>();
    expect(JSON.parse(row!.revoked)).toEqual({ reroll: 5, boost: 2, scout: 1 });
    expect(row!.at).toBe(NOW);
    expect(await handleAppleNotification(ctx.env, createDb(ctx.env.DB), 'payload', NOW)).toBe(
      'revoked',
    );
    expect(await items(me.cookie)).toMatchObject({ reroll: 2, boost: 0, scout: 0 });
    // 환불했어도 한 번 산 구단주에게 다시 팔지 않는다.
    expect((await state(me.cookie)).state).toBe('owned');
  });

  it('환불 알림이 먼저 온 거래는 줄만 남기고 주지 않는다', async () => {
    const me = await owner();
    await retire(me.profileId);
    await ctx.env.DB.prepare(
      `INSERT INTO iap_refund_markers (store, transaction_id, refunded_at) VALUES ('apple', 'tx1', ?)`,
    )
      .bind(NOW)
      .run();
    appleTx.current = appleFor(me.profileId, 'tx1');
    expect((await buy(me.cookie)).status).toBe(200);
    expect(await items(me.cookie)).toMatchObject({ reroll: 0, boost: 0, scout: 0 });
  });
});
