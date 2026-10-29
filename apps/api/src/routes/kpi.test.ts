import {
  REMOVE_ADS_PRICE_BEFORE_KRW,
  REMOVE_ADS_PRICE_CHANGED_AT,
  type KpiReport,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { billingAlerts, clientErrors, iapPurchases, memberships } from '../db/schema.js';
import {
  KPI_BACKFILL_DAYS,
  kstDayRange,
  kstPastDays,
  runKpiDaily,
  type KpiDailyResult,
} from '../db/repos/kpi.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueCookie } from '../test/http.js';

describe('운영 지표 대시보드 /v1/admin/kpi · /v1/internal/kpi (T-11-572)', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(env, method, path, opts);
  const report = async (cookie: string, days = 7) => {
    const res = await call('GET', `/v1/admin/kpi?days=${days}`, { cookie });
    expect(res.status).toBe(200);
    return ((await res.json()) as { data: KpiReport }).data;
  };
  const value = (r: KpiReport, day: string, metric: string, dim = 'all') =>
    r.rows.find((x) => x.day === day && x.metric === metric && x.dim === dim)?.value;

  beforeEach(async () => {
    ctx = await createTestD1();
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL, KPI_INGEST_TOKEN: 'kpi-secret' };
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('운영자만 읽는다 — 세션 없음 401, 일반 프로필 403, 기간은 7 · 30 · 90일만', async () => {
    const user = await issueCookie(ctx);
    expect((await call('GET', '/v1/admin/kpi')).status).toBe(401);
    expect((await call('GET', '/v1/admin/kpi', { cookie: user.cookie })).status).toBe(403);
    const admin = await issueAdminCookie(ctx);
    expect((await call('GET', '/v1/admin/kpi?days=5', { cookie: admin.cookie })).status).toBe(400);
    const r = await report(admin.cookie, 30);
    expect(r.days).toHaveLength(30);
    expect(r.rows).toEqual([]);
  });

  it('일일 단계가 어제 KST 하루를 모으고 다시 돌려도 값이 늘지 않는다', async () => {
    const admin = await issueAdminCookie(ctx);
    const at = Date.now();
    const [yesterday] = kstPastDays(at, 1);
    const { start } = kstDayRange(yesterday!);
    const mid = new Date(Date.parse(start) + 3_600_000).toISOString();
    await ctx.db.insert(iapPurchases).values([
      {
        store: 'google',
        transactionId: 'g1',
        profileId: admin.profileId,
        productId: 'com.offsidelab.app.reroll_40',
        item: 'reroll',
        qty: 40,
        createdAt: mid,
      },
      {
        store: 'apple',
        transactionId: 'a1',
        profileId: admin.profileId,
        productId: 'com.offsidelab.app.reroll_5',
        item: 'reroll',
        qty: 5,
        createdAt: mid,
      },
      // 테스트 결제는 세지 않는다.
      {
        store: 'apple',
        transactionId: 'a2',
        profileId: admin.profileId,
        productId: 'com.offsidelab.app.reroll_40',
        item: 'reroll',
        qty: 40,
        test: true,
        createdAt: mid,
      },
    ]);
    await ctx.db.insert(billingAlerts).values({
      id: 'b1',
      store: 'apple',
      kind: 'purchase',
      productId: 'com.offsidelab.app.remove_ads',
      test: false,
      createdAt: mid,
    });
    // T-11-577 멤버십 흐름: 어제 새로 가입(자동 갱신 끔) · 어제 갱신 알림 · 어제 끝난 묶음.
    const later = new Date(at + 20 * 86_400_000).toISOString();
    await ctx.db.insert(memberships).values([
      {
        store: 'apple',
        chainId: 'c1',
        profileId: admin.profileId,
        until: later,
        autoRenew: false,
        verifiedAt: mid,
        createdAt: mid,
      },
      {
        store: 'google',
        chainId: 'c2',
        profileId: admin.profileId,
        until: mid,
        autoRenew: false,
        verifiedAt: mid,
        createdAt: new Date(Date.parse(mid) - 30 * 86_400_000).toISOString(),
      },
    ]);
    await ctx.db.insert(billingAlerts).values({
      id: 'b2',
      store: 'google',
      kind: 'renewal',
      productId: 'com.offsidelab.app.club_monthly',
      test: false,
      createdAt: mid,
    });
    await ctx.db.insert(clientErrors).values(
      [3, 4].map((count, i) => ({
        day: yesterday!,
        fingerprint: `f${i}`,
        platform: 'android',
        kind: 'error',
        message: 'x',
        frame: '',
        place: '',
        stack: '',
        firstVersion: '1',
        lastVersion: '1',
        count,
        firstAt: mid,
        lastAt: mid,
      })),
    );

    let result: KpiDailyResult | undefined;
    let steps = 0;
    do {
      result = await runKpiDaily(env.DB, at, result);
      steps++;
    } while (!result.done && steps < 30);
    expect(result.done).toBe(true);
    // 3일 다시 쓰기 + 90일 거꾸로 채우기(7일씩).
    expect(steps).toBeLessThanOrEqual(Math.ceil(KPI_BACKFILL_DAYS / 7) + 1);
    await runKpiDaily(env.DB, at);

    const r = await report(admin.cookie);
    expect(value(r, yesterday!, 'iap_krw', 'google')).toBe(5500);
    expect(value(r, yesterday!, 'iap_krw', 'apple')).toBe(1100);
    expect(value(r, yesterday!, 'iap_count', 'apple')).toBe(1);
    expect(value(r, yesterday!, 'ad_free_count', 'apple')).toBe(1);
    // T-11-574 판매 시각의 정가(인상 전 3,300원, 뒤 6,600원).
    expect(value(r, yesterday!, 'ad_free_krw', 'apple')).toBe(
      mid >= REMOVE_ADS_PRICE_CHANGED_AT ? 6600 : REMOVE_ADS_PRICE_BEFORE_KRW,
    );
    expect(value(r, yesterday!, 'members_new', 'apple')).toBe(1);
    expect(value(r, yesterday!, 'members_renewed', 'google')).toBe(1);
    expect(value(r, yesterday!, 'members_expired', 'google')).toBe(1);
    expect(value(r, yesterday!, 'members_autorenew_off', 'apple')).toBe(1);
    expect(value(r, yesterday!, 'members_autorenew_off', 'google')).toBeUndefined();
    expect(value(r, yesterday!, 'client_errors', 'android')).toBe(7);
    expect(r.sources.map((s) => s.source)).toEqual(['d1']);
    expect(r.sources[0]!.lastDay).toBe(yesterday);
    const count = await env.DB.prepare('SELECT min(day) d FROM kpi_daily').first<{ d: string }>();
    expect(count!.d).toBe(kstPastDays(at, KPI_BACKFILL_DAYS).at(-1));
  });

  it('외부 지표는 토큰이 맞을 때만, 원천에 허용된 지표만 받는다', async () => {
    const admin = await issueAdminCookie(ctx);
    const [day] = kstPastDays(Date.now(), 1);
    const body = {
      day,
      source: 'ga4',
      rows: [
        { metric: 'dau', dim: 'web', value: 120 },
        { metric: 'dau', dim: 'android', value: 80 },
      ],
    };
    const post = (b: unknown, token = 'kpi-secret') =>
      call('POST', '/v1/internal/kpi', { body: b, headers: { Authorization: `Bearer ${token}` } });
    expect((await post(body, 'wrong')).status).toBe(404);
    expect((await call('POST', '/v1/internal/kpi', { body })).status).toBe(404);
    expect((await post({ ...body, source: 'd1' })).status).toBe(400);
    expect(
      (await post({ ...body, rows: [{ metric: 'iap_krw', dim: 'apple', value: 1 }] })).status,
    ).toBe(400);
    expect((await post(body)).status).toBe(200);
    // 같은 날 다시 보내면 그 지표를 통째로 바꾼다(빠진 나눔은 지운다).
    expect(
      (await post({ ...body, rows: [{ metric: 'dau', dim: 'web', value: 130 }] })).status,
    ).toBe(200);
    const r = await report(admin.cookie);
    expect(value(r, day!, 'dau', 'web')).toBe(130);
    expect(value(r, day!, 'dau', 'android')).toBeUndefined();
    expect(r.sources.map((s) => s.source)).toEqual(['ga4']);
  });

  it('운영 대시보드 Origin은 운영자 경로에만 CORS를 연다', async () => {
    const prod = {
      ...env,
      ENVIRONMENT: 'production',
    } as TestD1['env'];
    const preflight = (path: string, origin: string) =>
      callJson(prod, 'OPTIONS', `https://api.offside-lab.com${path}`, {
        headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
      });
    const admin = 'https://admin.offside-lab.com';
    expect(
      (await preflight('/v1/admin/kpi', admin)).headers.get('Access-Control-Allow-Origin'),
    ).toBe(admin);
    expect(
      (await preflight('/v1/profile', admin)).headers.get('Access-Control-Allow-Origin'),
    ).toBeNull();
    expect(
      (await preflight('/v1/admin/kpi', 'https://offside-lab.com')).headers.get(
        'Access-Control-Allow-Origin',
      ),
    ).toBe('https://offside-lab.com');
  });
});
