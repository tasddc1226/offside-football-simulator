import {
  REMOVE_ADS_PRICE_BEFORE_KRW,
  REMOVE_ADS_PRICE_CHANGED_AT,
  type KpiReport,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clientErrors } from '../db/opsSchema.js';
import { billingAlerts, iapPurchases, memberships } from '../db/schema.js';
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
    await ctx.ops.insert(clientErrors).values(
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

    // T-11-739 아이템 지금 상태 · 하루 사용 수.
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO owner_items (profile_id, item, qty, updated_at) VALUES (?1, 'boost', 12, ?2), (?1, 'scout', 0, ?2)",
      ).bind(admin.profileId, mid),
      env.DB.prepare(
        "INSERT INTO scout_pity (profile_id, used, streak, elites, mode, updated_at) VALUES (?1, 7, 0, 0, 'normal', ?2)",
      ).bind(admin.profileId, mid),
      env.DB.prepare(
        "INSERT INTO item_use_daily (day, item, uses) VALUES (?1, 'boost', 5), (?1, 'scout', 2)",
      ).bind(yesterday),
    ]);

    // T-11-741 밸런스 감시 · 새 기능 쓰는 비율(그날 은퇴) · 최상위 시즌 이적 · 광고 요약.
    const twoDaysAgo = new Date(Date.parse(start) - 86_400_000 + 3_600_000).toISOString();
    const career = (id: string, status: string, extra: string, values: unknown[]) =>
      env.DB.prepare(
        `INSERT INTO careers (id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at${extra})
         VALUES (?1, ?2, 'FW', '오른발', 'test', 'test', 2026, ?3, 'test', ?4, ?4${values.map((_, i) => `, ?${i + 5}`).join('')})`,
      ).bind(id, admin.profileId, status, mid, ...values);
    const season = (id: string, year: number, club: string, ovr: number, at: string) =>
      env.DB.prepare(
        `INSERT INTO career_seasons (career_id, year, age, club, league, apps, goals, assists, rating, rank, ovr, honors_json, mil, events_json, created_at)
         VALUES (?1, ?2, 26, ?3, '리그', 30, 10, 5, 7.5, 1, ?4, '[]', 0, '[]', ?5)`,
      ).bind(id, year, club, ovr, at);
    const telemetry = (ads: unknown, at: string) =>
      env.DB.prepare(
        `INSERT INTO season_telemetry (career_id, year, age, ovr, created_at, ads_json) VALUES ('car_ads', 2031, 26, 80, ?1, ?2)`,
      ).bind(at, JSON.stringify(ads));
    const retiredCols =
      ', retired_at, retire_age, peak, legend_score, ballon, item_top, legacy_tier';
    await env.DB.batch([
      career('ret1', 'retired', retiredCols, [mid, 33, 96, 900, 1, 3, 2]),
      career('ret2', 'retired', retiredCols, [mid, 35, 85, 300, 0, null, null]),
      career('el1', 'active', '', []),
      career('el2', 'active', '', []),
      season('el1', 2030, '구단A', 95, twoDaysAgo),
      season('el1', 2031, '구단B', 96, mid),
      season('el2', 2030, '구단A', 96, twoDaysAgo),
      season('el2', 2031, '구단A', 97, mid),
      season('el2', 2032, '구단C', 90, mid),
      // 운영처럼 시각 순서로 쌓인다(하루 범위를 id 이분 탐색으로 찾는다). 어제가 아닌 날은 세지 않는다.
      telemetry(
        { af: false, rw: { c: 9, p: 9, b: 9 }, fr: { c: 9, p: 9, b: 9 }, it: 9 },
        twoDaysAgo,
      ),
      telemetry(
        { af: false, rw: { c: 2, p: 1, b: 3, s: 1 }, fr: { c: 0, p: 0, b: 0 }, it: 1 },
        mid,
      ),
      telemetry({ af: true, rw: { c: 0, p: 0, b: 0 }, fr: { c: 1, p: 0, b: 4, a: 1 }, it: 0 }, mid),
      telemetry(
        { af: false, rw: { c: 7, p: 7, b: 7 }, fr: { c: 7, p: 7, b: 7 }, it: 7 },
        new Date(at).toISOString(),
      ),
    ]);

    let result: KpiDailyResult | undefined;
    let steps = 0;
    do {
      result = await runKpiDaily(env.DB, at, result, env.OPS_DB);
      steps++;
    } while (!result.done && steps < 30);
    expect(result.done).toBe(true);
    // 3일 다시 쓰기 + 90일 거꾸로 채우기(7일씩).
    expect(steps).toBeLessThanOrEqual(Math.ceil(KPI_BACKFILL_DAYS / 7) + 1);
    await runKpiDaily(env.DB, at, undefined, env.OPS_DB);

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
    expect(value(r, yesterday!, 'items_held', 'boost')).toBe(12);
    expect(value(r, yesterday!, 'items_holders', 'boost')).toBe(1);
    expect(value(r, yesterday!, 'items_holders', 'scout')).toBe(0);
    expect(value(r, yesterday!, 'items_used', 'boost')).toBe(5);
    expect(value(r, yesterday!, 'items_used', 'scout')).toBe(2);
    expect(value(r, yesterday!, 'items_used_total', 'scout')).toBe(7);
    expect(value(r, yesterday!, 'items_used_total', 'rename')).toBe(0);
    // 산 팩 장수(테스트 결제 40장은 빠진다).
    expect(value(r, yesterday!, 'items_bought', 'reroll')).toBe(45);
    expect(value(r, yesterday!, 'bal_retired_age')).toBe(34);
    expect(value(r, yesterday!, 'bal_retired_peak')).toBe(90.5);
    expect(value(r, yesterday!, 'bal_retired_ballon')).toBe(1);
    expect(value(r, yesterday!, 'bal_retired_peak_band', '95p')).toBe(1);
    expect(value(r, yesterday!, 'bal_retired_peak_band', '80_89')).toBe(1);
    // 최상위 시즌 2개(OVR 90 시즌은 빠진다) 가운데 전 시즌과 구단이 다른 1개.
    expect(value(r, yesterday!, 'bal_elite_seasons')).toBe(2);
    expect(value(r, yesterday!, 'bal_elite_moved')).toBe(1);
    expect(value(r, yesterday!, 'retired_item_top', '3')).toBe(1);
    expect(value(r, yesterday!, 'retired_item_top', '0')).toBe(1);
    expect(value(r, yesterday!, 'retired_legacy', '2')).toBe(1);
    expect(value(r, yesterday!, 'ads_uploads')).toBe(2);
    expect(value(r, yesterday!, 'ads_uploads_ad_free')).toBe(1);
    expect(value(r, yesterday!, 'ads_interstitial')).toBe(1);
    expect(value(r, yesterday!, 'ads_rewarded', 'b')).toBe(3);
    expect(value(r, yesterday!, 'ads_rewarded', 's')).toBe(1);
    expect(value(r, yesterday!, 'ads_rewarded', 'a')).toBe(0);
    expect(value(r, yesterday!, 'ads_free_rewards', 'b')).toBe(4);
    expect(value(r, yesterday!, 'ads_free_rewards', 'a')).toBe(1);
    expect(r.sources.map((s) => s.source)).toEqual(['d1']);
    expect(r.sources[0]!.lastDay).toBe(yesterday);
    const count = await env
      .OPS_DB!.prepare('SELECT min(day) d FROM kpi_daily')
      .first<{ d: string }>();
    expect(count!.d).toBe(kstPastDays(at, KPI_BACKFILL_DAYS).at(-1));
  }, 40_000);

  it('T-11-693 서버 상태 · 라운지 채팅 · 컵 참가를 하루치로 넣고, 채팅방이 답하지 못해도 나머지는 쓴다', async () => {
    const admin = await issueAdminCookie(ctx);
    const at = Date.now();
    const [yesterday] = kstPastDays(at, 1);
    const { start } = kstDayRange(yesterday!);
    const bucket = (min: number) => new Date(Date.parse(start) + min * 60_000).toISOString();
    await env.OPS_DB!.batch([
      env
        .OPS_DB!.prepare(
          'INSERT INTO api_status_buckets (bucket, requests, total_ms, slow, errors) VALUES (?, 100, 8000, 3, 2)',
        )
        .bind(bucket(5)),
      env
        .OPS_DB!.prepare(
          'INSERT INTO api_status_buckets (bucket, requests, total_ms, slow, errors) VALUES (?, 100, 12000, 1, 0)',
        )
        .bind(bucket(10)),
    ]);
    const asked: [number, number][] = [];
    await runKpiDaily(env.DB, at, undefined, env.OPS_DB, async (from, to) => {
      asked.push([from, to]);
      return [
        { room: 'ko', messages: 40, writers: 9 },
        { room: 'en', messages: 2, writers: 1 },
      ];
    });
    // 채팅은 채팅방에 남아 있는 최근 며칠(다시 쓰는 날)만 묻는다.
    expect(asked).toHaveLength(3);
    expect(asked[0]![1] - asked[0]![0]).toBe(86_400_000);
    let r = await report(admin.cookie);
    expect(value(r, yesterday!, 'api_requests')).toBe(200);
    expect(value(r, yesterday!, 'api_errors')).toBe(2);
    expect(value(r, yesterday!, 'api_slow')).toBe(4);
    expect(value(r, yesterday!, 'api_avg_ms')).toBe(100);
    expect(value(r, yesterday!, 'chat', 'ko')).toBe(40);
    expect(value(r, yesterday!, 'chat_writers', 'en')).toBe(1);
    expect(value(r, yesterday!, 'cup_entries')).toBe(0);
    // 알림이 없던 날은 행을 만들지 않는다(0으로 채우지 않는다).
    expect(value(r, yesterday!, 'push_recipients', 'team')).toBeUndefined();

    await runKpiDaily(env.DB, at, undefined, env.OPS_DB, () => Promise.reject(new Error('down')));
    r = await report(admin.cookie);
    expect(value(r, yesterday!, 'api_requests')).toBe(200);
    expect(value(r, yesterday!, 'chat', 'ko')).toBe(40);
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
