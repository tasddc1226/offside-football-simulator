import { describe, expect, it, vi } from 'vitest';
import {
  COMMERCE_EVENT,
  commerceOffer,
  commerceParams,
  createCheckoutFunnel,
  type CommerceObservation,
} from './commerceStage.js';
import { createNativeAnalytics, type NativeAnalyticsSDK } from './analytics-native.js';
import { emptyLedger, type Consent, type Params } from './analytics-model.js';

const BOOST10 = 'com.offsidelab.app.boost_10';
const SCOUT5 = 'com.offsidelab.app.scout_5';

describe('commerce_stage contract (allowlist)', () => {
  it('maps only boost · scout packs; everything else is not measured', () => {
    expect(commerceOffer(BOOST10, 'shop', 'apple')).toEqual({
      item: 'boost',
      entry: 'shop',
      store: 'apple',
      packSize: 10,
    });
    expect(commerceOffer(SCOUT5, 'player_tab', 'xsolla')?.item).toBe('scout');
    for (const id of [
      'com.offsidelab.app.reroll_5',
      'com.offsidelab.app.rename_5',
      'com.offsidelab.app.remove_ads',
      'com.offsidelab.app.season_pass',
      '__proto__',
      'toString',
      null,
      42,
    ])
      expect(commerceOffer(id, 'shop', 'google')).toBeNull();
  });

  it('builds only allowlisted low-cardinality params (no ids, tokens, price, currency, value, error text)', () => {
    const p = commerceParams({
      stage: 'grant_fail',
      item: 'boost',
      entry: 'shop',
      store: 'google',
      packSize: 3,
      reason: 'grant_retryable',
    });
    expect(p).toEqual({
      commerce_contract: '1',
      stage: 'grant_fail',
      offer_item: 'boost',
      entrypoint: 'shop',
      store: 'google',
      pack_size: 3,
      reason: 'grant_retryable',
    });
    // 목록 밖 키는 복사되지 않는다.
    const leaky = commerceParams({
      stage: 'grant_ack',
      item: 'scout',
      entry: 'player_tab',
      store: 'apple',
      profileId: 'p_secret',
      careerId: 'c_secret',
      orderId: 'wp_x',
      token: 'jws',
      receipt: 'r',
      url: 'https://x',
      error: 'Network failed',
      value: 1100,
      currency: 'KRW',
      price: '₩1,100',
    } as unknown as CommerceObservation);
    expect(Object.keys(leaky!).sort()).toEqual(
      ['commerce_contract', 'entrypoint', 'offer_item', 'stage', 'store'].sort(),
    );
  });

  it.each([
    { stage: 'purchase', item: 'boost', entry: 'shop', store: 'apple' },
    { stage: 'in_app_purchase', item: 'boost', entry: 'shop', store: 'apple' },
    { stage: 'offer_view', item: 'reroll', entry: 'shop', store: 'apple' },
    { stage: 'offer_view', item: 'boost', entry: 'home', store: 'apple' },
    { stage: 'offer_view', item: 'boost', entry: 'shop', store: 'paypal' },
    { stage: 'offer_select', item: 'boost', entry: 'shop', store: 'apple', packSize: 7 },
    { stage: 'checkout_error', item: 'boost', entry: 'shop', store: 'apple', reason: 'E_NET 500' },
    // 이유는 오류 · 지급 실패 단계에만.
    { stage: 'grant_ack', item: 'boost', entry: 'shop', store: 'apple', reason: 'store_error' },
    null,
    'x',
  ])('drops anything outside the allowlist: %j', (o) => {
    expect(commerceParams(o)).toBeNull();
  });
});

type Emitted = { o: CommerceObservation; alive: () => boolean };
function funnelHarness(start = 1_000_000) {
  let t = start;
  const out: Emitted[] = [];
  const f = createCheckoutFunnel(
    (o, alive) => out.push({ o, alive }),
    () => t,
  );
  const offer = commerceOffer(BOOST10, 'player_tab', 'apple');
  return {
    f,
    out,
    offer,
    stages: () => out.map((e) => e.o.stage),
    tick: (ms: number) => (t += ms),
    now: () => t,
  };
}

describe('checkout funnel state', () => {
  it('select → request → grant_ack only after server ack ticket', () => {
    const h = funnelHarness();
    h.f.begin(BOOST10, h.offer);
    h.f.requested();
    const t = h.f.take({ id: 'tx1', productId: BOOST10, transactionDate: h.now() + 500 });
    expect(h.stages()).toEqual(['offer_select', 'checkout_request']);
    h.f.granted(t);
    expect(h.stages()).toEqual(['offer_select', 'checkout_request', 'grant_ack']);
    expect(h.out.at(-1)!.o).toMatchObject({ item: 'boost', entry: 'player_tab', packSize: 10 });
  });

  it('cancel · pending · error end the attempt; later callbacks emit nothing', () => {
    for (const end of ['cancel', 'pending', 'store_error'] as const) {
      const h = funnelHarness();
      h.f.begin(BOOST10, h.offer);
      h.f.requested();
      if (end === 'store_error') h.f.fail('store_error');
      else h.f[end]();
      h.f.cancel();
      h.f.fail('start_failed');
      const t = h.f.take({ id: 'tx', productId: BOOST10, transactionDate: h.now() });
      h.f.granted(t);
      expect(t).toBeNull();
      expect(h.stages()).toEqual([
        'offer_select',
        'checkout_request',
        end === 'cancel'
          ? 'checkout_cancel'
          : end === 'pending'
            ? 'checkout_pending'
            : 'checkout_error',
      ]);
    }
  });

  it('a duplicate callback for the same transaction yields no second ticket', () => {
    const h = funnelHarness();
    h.f.begin(BOOST10, h.offer);
    const p = { id: 'tx1', productId: BOOST10, transactionDate: h.now() };
    expect(h.f.take(p)).not.toBeNull();
    expect(h.f.take(p)).toBeNull();
  });

  it('an old same-SKU transaction during a new checkout is ambiguous: no ticket, attempt dropped', () => {
    const h = funnelHarness();
    h.f.begin(BOOST10, h.offer);
    const old = {
      id: 'old',
      productId: BOOST10,
      transactionDate: h.now() - 1000, // 시도 1초 전에 생긴 같은 상품 거래(복구 대상)
    };
    expect(h.f.take(old)).toBeNull();
    // 진짜 새 거래가 뒤따라와도 시도는 이미 버렸다(보수적으로 세지 않는다).
    expect(h.f.take({ id: 'new', productId: BOOST10, transactionDate: h.now() })).toBeNull();
  });

  it('accepts a transaction at or after checkout start only (1 ms earlier is ambiguous)', () => {
    const at = funnelHarness();
    at.f.begin(BOOST10, at.offer);
    expect(at.f.take({ id: 'a', productId: BOOST10, transactionDate: at.now() })).not.toBeNull();
    const early = funnelHarness();
    early.f.begin(BOOST10, early.offer);
    expect(
      early.f.take({ id: 'b', productId: BOOST10, transactionDate: early.now() - 1 }),
    ).toBeNull();
  });

  it.each([
    { id: undefined, transactionDate: 1_000_000 },
    { id: '', transactionDate: 1_000_000 },
    { id: 'tx', transactionDate: undefined },
    { id: 'tx', transactionDate: Number.NaN },
  ])('missing transaction id / time is ambiguous (%j)', (p) => {
    const h = funnelHarness();
    h.f.begin(BOOST10, h.offer);
    expect(h.f.take({ productId: BOOST10, ...p })).toBeNull();
  });

  it('a transaction already seen in store sync / recovery is never a new success', () => {
    const h = funnelHarness();
    h.f.known({ id: 'left', productId: BOOST10 });
    h.f.begin(BOOST10, h.offer);
    expect(h.f.take({ id: 'left', productId: BOOST10, transactionDate: h.now() })).toBeNull();
  });

  it('reset (account switch / consent change) invalidates the in-flight ticket and queued sends', () => {
    const h = funnelHarness();
    h.f.begin(BOOST10, h.offer);
    h.f.requested();
    const t = h.f.take({ id: 'tx1', productId: BOOST10, transactionDate: h.now() });
    expect(t).not.toBeNull();
    const queued = h.out.map((e) => e.alive);
    expect(queued.every((a) => a())).toBe(true);
    h.f.reset();
    expect(queued.some((a) => a())).toBe(false);
    h.f.granted(t);
    h.f.grantFailed(t, true);
    expect(h.stages()).toEqual(['offer_select', 'checkout_request']);
    // 새 epoch의 새 시도는 정상으로 남는다.
    h.f.begin(BOOST10, h.offer);
    expect(h.out.at(-1)!.alive()).toBe(true);
  });

  it('reset before the purchase callback: the attempt is gone', () => {
    const h = funnelHarness();
    h.f.begin(BOOST10, h.offer);
    h.f.reset();
    expect(h.f.take({ id: 'tx1', productId: BOOST10, transactionDate: h.now() })).toBeNull();
  });

  it('non-measured products clear the previous attempt and emit nothing', () => {
    const h = funnelHarness();
    h.f.begin(BOOST10, h.offer);
    h.f.begin('com.offsidelab.app.reroll_5', null);
    h.f.requested();
    expect(h.f.take({ id: 'tx', productId: BOOST10, transactionDate: h.now() })).toBeNull();
    expect(h.stages()).toEqual(['offer_select']);
  });

  it('emit throwing (sync) never escapes into the purchase flow', () => {
    const f = createCheckoutFunnel(() => {
      throw new Error('sdk');
    });
    const offer = commerceOffer(SCOUT5, 'shop', 'google');
    expect(() => {
      f.view(offer);
      f.begin(SCOUT5, offer);
      f.requested();
      const t = f.take({ id: 'a', productId: SCOUT5, transactionDate: Date.now() });
      f.granted(t);
      f.grantFailed(t, false);
      f.cancel();
    }).not.toThrow();
  });
});

function nativeHarness(initial: Consent, event?: NativeAnalyticsSDK['event']) {
  let consent: Consent = initial;
  const events: { name: string; params: Params }[] = [];
  const sdk: NativeAnalyticsSDK = {
    consent: vi.fn(async () => {}),
    collect: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
    event:
      event ??
      vi.fn(async (name: string, params: Params) => {
        events.push({ name, params });
      }),
  };
  const a = createNativeAnalytics({
    enabled: () => true,
    load: async () => sdk,
    readConsent: () => consent,
    writeConsent: (v) => {
      consent = v;
    },
    readLedger: () => emptyLedger(),
    writeLedger: () => {},
    now: () => 1,
    appVersion: '1.2.3',
  });
  a.initialize('shop', null);
  const commerce = events.filter.bind(events);
  return { a, sdk, events, commerce: () => commerce((e) => e.name === COMMERCE_EVENT) };
}
const obs: CommerceObservation = {
  stage: 'offer_select',
  item: 'boost',
  entry: 'shop',
  store: 'apple',
  packSize: 3,
};

describe('native analytics commerce transport', () => {
  it.each(['unknown', 'denied'] as const)(
    'sends nothing without analytics consent (%s)',
    async (c) => {
      const h = nativeHarness(c);
      await h.a.settled();
      h.a.commerce(obs);
      await h.a.settled();
      expect(h.commerce()).toEqual([]);
    },
  );

  it('sends allowlisted params with consent; app version and measurement version only', async () => {
    const h = nativeHarness('granted');
    await h.a.settled();
    h.a.commerce(obs);
    await h.a.settled();
    expect(h.commerce()).toEqual([
      {
        name: 'commerce_stage',
        params: {
          measurement_version: '2',
          app_version: '1.2.3',
          commerce_contract: '1',
          stage: 'offer_select',
          offer_item: 'boost',
          entrypoint: 'shop',
          store: 'apple',
          pack_size: 3,
        },
      },
    ]);
  });

  it('consent revoked while a send is queued: dropped at SDK emission (no queue replay)', async () => {
    const h = nativeHarness('granted');
    await h.a.settled();
    h.a.commerce(obs);
    h.a.setConsent('denied');
    await h.a.settled();
    h.a.setConsent('granted');
    await h.a.settled();
    expect(h.commerce()).toEqual([]);
  });

  it('alive() is re-checked at actual SDK emission (account epoch)', async () => {
    const h = nativeHarness('granted');
    await h.a.settled();
    let alive = true;
    h.a.commerce(obs, () => alive);
    alive = false; // 계정이 줄에 올라간 뒤 바뀜
    await h.a.settled();
    expect(h.commerce()).toEqual([]);
    h.a.commerce(obs, () => false);
    await h.a.settled();
    expect(h.commerce()).toEqual([]);
  });

  it('SDK sync throw / async rejection never reaches the caller', async () => {
    for (const event of [
      vi.fn(() => {
        throw new Error('sync');
      }),
      vi.fn(async () => {
        throw new Error('async');
      }),
    ] as NativeAnalyticsSDK['event'][]) {
      const h = nativeHarness('granted', event);
      await h.a.settled();
      expect(() => h.a.commerce(obs)).not.toThrow();
      await expect(h.a.settled()).resolves.toBeUndefined();
      expect(() => h.a.commerce({ ...obs, stage: 'grant_ack' })).not.toThrow();
    }
  });

  it('invalid observations are dropped before the SDK', async () => {
    const h = nativeHarness('granted');
    await h.a.settled();
    h.a.commerce({ ...obs, item: 'reroll' } as unknown as CommerceObservation);
    await h.a.settled();
    expect(h.commerce()).toEqual([]);
  });
});
