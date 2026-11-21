import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { deleteVoicesStatement, openVoiceCountQuery, voiceListQuery } from '../db/repos/voices.js';
import { userVoices } from '../db/schema.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  callJson,
  deleteProfile,
  issueAdminCookie,
  issueCookie,
  issueGoogleCookie,
} from '../test/http.js';

// T-11-802 게임 안 의견 보내기. 메일은 example.com · .test, IP는 문서용 대역만 쓴다.
const IP = '203.0.113.7';
const TOO_OFTEN = {
  ko: '의견을 너무 자주 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  en: "You're sending feedback too often. Please try again shortly.",
  ja: 'ご意見の送信が多すぎます。しばらくしてからもう一度お試しください。',
  zh: '意見送出太頻繁，請稍後再試。',
} as const;

type ErrorBody = { error: { code: string; message: string } };

let ctx: TestD1;
let env: TestD1['env'];
beforeEach(async () => {
  ctx = await createTestD1();
  env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
});
afterEach(async () => {
  await ctx.dispose();
});

/** 쿠키(웹 세션)로 의견을 보낸다. 횟수 제한 주체가 'unknown'으로 묶이지 않게 접속 IP를 꼭 넣는다. */
const send = (
  cookie: string | undefined,
  body: Record<string, unknown>,
  opts: { path?: string; ip?: string; env?: TestD1['env'] } = {},
) =>
  callJson(opts.env ?? env, 'POST', opts.path ?? '/v1/voices', {
    ...(cookie ? { cookie } : {}),
    body,
    headers: { 'CF-Connecting-IP': opts.ip ?? IP },
  });
const rows = () => ctx.db.select().from(userVoices);
const errorOf = async (res: Response) => ((await res.json()) as ErrorBody).error;

describe('의견 보내기 POST /v1/voices', () => {
  it('익명 프로필로 보내면 204(본문 없음)이고, 다듬고 가린 본문과 맥락을 저장한다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const res = await send(cookie, {
      kind: 'bug',
      body: '  결제 화면이 멈춰요. 답장은 fan@example.com 으로  ',
      screen: 'settings',
      platform: 'web',
      version: '2026.11.21-abc',
      device: 'ios instagram',
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    const [row] = await rows();
    expect(row).toMatchObject({
      profileId,
      kind: 'bug',
      body: '결제 화면이 멈춰요. 답장은 [email] 으로',
      screen: 'settings',
      platform: 'web',
      appVersion: '2026.11.21-abc',
      device: 'ios instagram',
      lang: 'ko',
      resolvedAt: null,
    });
    expect(row!.id).toMatch(/^vox_/);
    expect(row!.bodyKey).toMatch(/^[0-9a-f]{16}$/);
  });

  it('맥락은 서버가 정한다: ?lang=ja, 웹 세션의 ios는 web, 모르는 종류는 other, 패턴 밖 입구는 null', async () => {
    const { cookie } = await issueCookie(ctx);
    const res = await send(
      cookie,
      { body: '日本語で書きました', kind: 'praise', screen: 'Home Screen', platform: 'ios' },
      { path: '/v1/voices?lang=ja' },
    );
    expect(res.status).toBe(204);
    expect(await rows()).toMatchObject([
      {
        lang: 'ja',
        kind: 'other',
        screen: null,
        platform: 'web',
        appVersion: 'unknown',
        device: null,
      },
    ]);
  });

  it('앱 세션이 보낸 ios · android는 그대로 적는다', async () => {
    const app = await createApp().request(
      '/v1/app/session',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      env,
    );
    const { token } = ((await app.json()) as { data: { token: string } }).data;
    const res = await createApp().request(
      '/v1/voices',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'CF-Connecting-IP': IP,
        },
        body: JSON.stringify({
          body: '앱에서 보냅니다',
          screen: 'home',
          platform: 'android',
          version: '1.1.7 (45) · abcd1234',
          device: 'android 34',
        }),
      },
      env,
    );
    expect(res.status).toBe(204);
    expect(await rows()).toMatchObject([
      {
        kind: 'other',
        screen: 'home',
        platform: 'android',
        appVersion: '1.1.7 (45) · abcd1234',
        device: 'android 34',
      },
    ]);
  });

  it('세션이 없으면 401 PROFILE_REQUIRED', async () => {
    const res = await send(undefined, { body: '안녕하세요' });
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe('PROFILE_REQUIRED');
    expect(await rows()).toHaveLength(0);
  });

  it('빈 글 · 501자 · 보이지 않는 글자만 있는 글은 400', async () => {
    const { cookie } = await issueCookie(ctx);
    const invisible = String.fromCodePoint(0x3164, 0x3164, 0x200b);
    for (const body of ['', '   ', '가', '가'.repeat(501), invisible]) {
      const res = await send(cookie, { body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await errorOf(res)).code).toBe('VALIDATION_FAILED');
    }
    expect((await send(cookie, { body: 'x', kind: 'k'.repeat(201) })).status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it('같은 글(공백 · 대소문자만 다름)을 두 번 보내면 둘 다 204이고 한 번만 남는다', async () => {
    const { cookie } = await issueCookie(ctx);
    expect((await send(cookie, { body: 'Login  Button\nis broken' })).status).toBe(204);
    expect((await send(cookie, { body: 'login button is BROKEN' })).status).toBe(204);
    expect(await rows()).toHaveLength(1);
    // 다른 사람이 같은 글을 보내면 따로 남는다.
    const other = await issueCookie(ctx);
    expect((await send(other.cookie, { body: 'login button is broken' })).status).toBe(204);
    expect(await rows()).toHaveLength(2);
  });

  it('처리한 의견과 같은 글을 다시 보내면 그 의견을 다시 연다', async () => {
    const { cookie } = await issueCookie(ctx);
    expect((await send(cookie, { body: '로그인이 안 돼요' })).status).toBe(204);
    await ctx.db.update(userVoices).set({
      resolvedAt: '2026-11-20T00:00:00.000Z',
      createdAt: '2026-11-19T00:00:00.000Z',
    });
    expect((await send(cookie, { body: '로그인이 안 돼요' })).status).toBe(204);
    const [row, ...rest] = await rows();
    expect(rest).toHaveLength(0);
    expect(row!.resolvedAt).toBeNull();
    expect(row!.createdAt > '2026-11-19T00:00:00.000Z').toBe(true);
  });

  it('프로필당 시간당 5번. 6번째는 429이고 언어별 문장으로 답한다. 막힌 시도는 IP 횟수에 세지 않는다', async () => {
    const { cookie } = await issueCookie(ctx);
    for (let i = 0; i < 5; i++)
      expect((await send(cookie, { body: `의견 ${i}번` })).status).toBe(204);
    const blocked = await send(cookie, { body: '의견 6번' });
    expect(blocked.status).toBe(429);
    expect(await errorOf(blocked)).toMatchObject({ code: 'RATE_LIMITED', message: TOO_OFTEN.ko });
    // 횟수 제한 문장은 enforceLimit에 넘기는 상수라 errorText 검사가 잡지 못해 여기서 고정한다.
    for (const lang of ['en', 'ja', 'zh'] as const) {
      const res = await send(cookie, { body: '의견 7번' }, { path: `/v1/voices?lang=${lang}` });
      expect(res.status).toBe(429);
      const { message } = await errorOf(res);
      expect(message).toBe(TOO_OFTEN[lang]);
      expect(message).not.toMatch(/[가-힣]/);
    }
    expect(await rows()).toHaveLength(5);
    const ip = await ctx.env
      .OPS_DB!.prepare("SELECT count FROM auth_attempts WHERE kind = 'VOICE_IP' AND subject = ?")
      .bind(IP)
      .first<{ count: number }>();
    expect(ip?.count).toBe(5);
  });

  it('같은 IP는 시간당 20번. 21번째 프로필은 429', async () => {
    for (let i = 0; i < 20; i++) {
      const { cookie } = await issueCookie(ctx);
      expect((await send(cookie, { body: `같은 IP ${i}` })).status).toBe(204);
    }
    const last = await issueCookie(ctx);
    expect((await send(last.cookie, { body: '같은 IP 20' })).status).toBe(429);
    // 다른 IP는 그대로 보낸다.
    expect((await send(last.cookie, { body: '다른 IP' }, { ip: '198.51.100.9' })).status).toBe(204);
  });

  /** 시즌 일정 읽기(1분 메모)를 데운 뒤 두 DB의 왕복을 센다. */
  const spied = async (extra: Partial<TestD1['env']> = {}) => {
    await callJson(env, 'GET', '/v1/health');
    const core = spyDb(ctx.env.DB);
    const ops = spyDb(ctx.env.OPS_DB!);
    return { core, ops, env: { ...env, ...extra, DB: core.DB, OPS_DB: ops.DB } };
  };

  it('VOICE_DISABLED=1이면 세션 · DB를 읽기 전에 503', async () => {
    const { cookie } = await issueCookie(ctx);
    const { core, ops, env: off } = await spied({ VOICE_DISABLED: '1' });
    const res = await send(cookie, { body: '비상 스위치' }, { env: off });
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe('SERVICE_UNAVAILABLE');
    expect(core.trips.n + ops.trips.n, [...core.trips.log, ...ops.trips.log].join('\n')).toBe(0);
    expect(await rows()).toHaveLength(0);
  });

  it('D1 왕복: 게임 DB 2번(세션 · 저장), 운영 DB 2번(두 한도)', async () => {
    const { cookie } = await issueCookie(ctx);
    const { core, ops, env: watched } = await spied();
    expect((await send(cookie, { body: '왕복 수를 셉니다' }, { env: watched })).status).toBe(204);
    expect(core.trips.n, core.trips.log.join('\n')).toBe(2);
    expect(ops.trips.n, ops.trips.log.join('\n')).toBe(2);
    expect(core.trips.log[1]).toMatch(/^insert into "user_voices"/);
  });

  it('계정을 삭제하면 그 사람의 의견만 바로 지운다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    expect((await send(a.cookie, { body: '지울 의견입니다' })).status).toBe(204);
    expect((await send(b.cookie, { body: '남을 의견입니다' })).status).toBe(204);
    expect((await deleteProfile(env, a.cookie, 'idem-voice-del')).status).toBe(204);
    expect(await rows()).toMatchObject([{ profileId: b.profileId }]);
  });
});

describe('운영 목록 · 처리 /v1/admin/voices', () => {
  let seq = 0;
  const add = (over: Partial<typeof userVoices.$inferInsert> & { createdAt: string }) =>
    ctx.db
      .insert(userVoices)
      .values({
        id: `vox_${++seq}`,
        profileId: 'prf_none',
        kind: 'bug',
        body: `본문 ${seq}`,
        bodyKey: `key${seq}`,
        platform: 'web',
        appVersion: 'dev',
        lang: 'ko',
        ...over,
      })
      .returning({ id: userVoices.id })
      .then(([r]) => r!.id);
  type List = {
    data: {
      items: { id: string; linked: boolean; resolvedAt: string | null; profileId: string }[];
      hasMore: boolean;
      open: number;
    };
  };
  const list = async (cookie: string, qs = '') => {
    const res = await callJson(env, 'GET', `/v1/admin/voices${qs}`, { cookie });
    expect(res.status, qs).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    return ((await res.json()) as List).data;
  };
  const resolve = (cookie: string, ids: string[], resolved: boolean) =>
    callJson(env, 'POST', '/v1/admin/voices/resolve', { cookie, body: { ids, resolved } });

  it('운영자만 본다: 세션이 없으면 401, 익명 · 운영자 아닌 구글 계정은 403', async () => {
    const anon = await issueCookie(ctx);
    const google = await issueGoogleCookie(ctx, { email: 'fan@example.com' });
    expect((await callJson(env, 'GET', '/v1/admin/voices')).status).toBe(401);
    for (const who of [anon, google]) {
      expect((await callJson(env, 'GET', '/v1/admin/voices', { cookie: who.cookie })).status).toBe(
        403,
      );
      expect((await resolve(who.cookie, ['vox_1'], true)).status).toBe(403);
    }
  });

  it('열린 것 · 전체, 종류 · 프로필 필터, 더 보기, 열린 건수, 로그인 구단주 여부', async () => {
    const admin = await issueAdminCookie(ctx);
    const anon = await issueCookie(ctx);
    const owner = await issueGoogleCookie(ctx);
    const v1 = await add({ profileId: anon.profileId, createdAt: '2026-11-20T00:00:01.000Z' });
    const v2 = await add({
      profileId: owner.profileId,
      kind: 'idea',
      createdAt: '2026-11-20T00:00:02.000Z',
    });
    const v3 = await add({
      profileId: anon.profileId,
      kind: 'other',
      createdAt: '2026-11-20T00:00:03.000Z',
      resolvedAt: '2026-11-20T01:00:00.000Z',
    });
    const v4 = await add({ profileId: owner.profileId, createdAt: '2026-11-20T00:00:04.000Z' });
    const ids = (d: List['data']) => d.items.map((v) => v.id);

    const open = await list(admin.cookie);
    expect(ids(open)).toEqual([v4, v2, v1]);
    expect(open).toMatchObject({ hasMore: false, open: 3 });
    expect(open.items.map((v) => v.linked)).toEqual([true, true, false]);
    expect(ids(await list(admin.cookie, '?status=all'))).toEqual([v4, v3, v2, v1]);
    expect(ids(await list(admin.cookie, '?kind=bug'))).toEqual([v4, v1]);
    const mine = await list(admin.cookie, `?status=all&profile=${anon.profileId}`);
    expect(ids(mine)).toEqual([v3, v1]);
    expect(mine.open).toBe(3);

    const first = await list(admin.cookie, '?limit=2');
    expect(ids(first)).toEqual([v4, v2]);
    expect(first.hasMore).toBe(true);
    const next = await list(admin.cookie, '?limit=2&before=2026-11-20T00:00:02.000Z');
    expect(ids(next)).toEqual([v1]);
    expect(next.hasMore).toBe(false);

    // 앱 · 웹이 붙이는 ?lang=은 엄격한 쿼리 검사에서 뺀다. 모르는 쿼리 · 상한 밖 limit은 400.
    expect(ids(await list(admin.cookie, '?lang=en'))).toEqual([v4, v2, v1]);
    for (const qs of ['?foo=1', '?limit=101', '?status=closed'])
      expect(
        (await callJson(env, 'GET', `/v1/admin/voices${qs}`, { cookie: admin.cookie })).status,
      ).toBe(400);
  });

  it('처리와 다시 열기: 상태가 바뀐 수만 세고, 없는 id는 건너뛴다', async () => {
    const admin = await issueAdminCookie(ctx);
    const v1 = await add({ createdAt: '2026-11-20T00:00:01.000Z' });
    const v2 = await add({ createdAt: '2026-11-20T00:00:02.000Z' });
    const v3 = await add({ createdAt: '2026-11-20T00:00:03.000Z' });

    const done = await resolve(admin.cookie, [v1, v2, 'vox_none'], true);
    expect(done.status).toBe(200);
    expect(done.headers.get('Cache-Control')).toBe('private, no-store');
    expect(((await done.json()) as { data: { updated: number } }).data.updated).toBe(2);
    const after = await list(admin.cookie);
    expect(after.items.map((v) => v.id)).toEqual([v3]);
    expect(after.open).toBe(1);
    const all = await list(admin.cookie, '?status=all');
    expect(all.items.find((v) => v.id === v1)!.resolvedAt).toMatch(/Z$/);

    // 이미 처리한 것을 다시 처리하면 0, 다시 열면 그 수만큼.
    const again = await resolve(admin.cookie, [v1], true);
    expect(((await again.json()) as { data: { updated: number } }).data.updated).toBe(0);
    const reopen = await resolve(admin.cookie, [v1, v3], false);
    expect(((await reopen.json()) as { data: { updated: number } }).data.updated).toBe(1);
    expect((await list(admin.cookie)).items.map((v) => v.id)).toEqual([v3, v1]);

    const tooMany = Array.from({ length: 51 }, (_, i) => `vox_${i}`);
    expect((await resolve(admin.cookie, tooMany, true)).status).toBe(400);
    expect((await resolve(admin.cookie, [], true)).status).toBe(400);
  });
});

describe('T-11-802 의견 표 쿼리 계획', () => {
  let plans: TestD1;
  beforeAll(async () => {
    plans = await createTestD1();
  });
  afterAll(async () => {
    await plans.dispose();
  });
  const plan = async (q: { sql: string; params: unknown[] }) =>
    (
      await plans.env.DB.prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
        .bind(...q.params)
        .all<{ detail: string }>()
    ).results
      .map((r) => r.detail)
      .join('\n');
  const before = '2026-11-21T00:00:00.000Z';

  it('열린 목록 · 전체 목록 · 열린 건수 · 보관 정리 · 프로필 삭제가 인덱스를 쓰고 표 전체를 훑지 않는다', async () => {
    const cases: [string, { sql: string; params: unknown[] }, string][] = [
      ['열린 목록', voiceListQuery(plans.db, { status: 'open', limit: 50 }).toSQL(), 'open_idx'],
      [
        '열린 목록 더 보기',
        voiceListQuery(plans.db, { status: 'open', before, limit: 50 }).toSQL(),
        'open_idx',
      ],
      ['전체 목록', voiceListQuery(plans.db, { status: 'all', limit: 50 }).toSQL(), 'created_idx'],
      [
        '전체 목록 더 보기',
        voiceListQuery(plans.db, { status: 'all', before, limit: 50 }).toSQL(),
        'created_idx',
      ],
      ['열린 건수', openVoiceCountQuery(plans.db).toSQL(), 'open_idx'],
      [
        '보관 정리(cron/cleanup.ts)',
        {
          sql: 'DELETE FROM user_voices WHERE rowid IN (SELECT rowid FROM user_voices WHERE created_at < ?1 LIMIT 5000)',
          params: [before],
        },
        'created_idx',
      ],
      [
        '아침 건수(slack-ops.mjs)',
        {
          sql: 'SELECT kind, lang, COUNT(*) AS n FROM user_voices WHERE created_at>=? AND created_at<? GROUP BY kind, lang',
          params: [before, before],
        },
        'created_idx',
      ],
      ['프로필 삭제', deleteVoicesStatement(plans.db, 'prf_x').toSQL(), 'profile_body_unique'],
    ];
    for (const [name, q, index] of cases) {
      const p = await plan(q);
      expect(p, name).toContain(`user_voices_${index}`);
      expect(p, name).not.toMatch(/^SCAN user_voices$/m);
    }
    for (const [name, q] of cases.slice(0, 4))
      expect(await plan(q), name).not.toMatch(/TEMP B-TREE FOR ORDER BY/);
    // 이 프로필만: 프로필 인덱스로 찾는다.
    const profile = await plan(
      voiceListQuery(plans.db, { status: 'all', profile: 'prf_x', limit: 50 }).toSQL(),
    );
    expect(profile).toMatch(/USING (COVERING )?INDEX user_voices_/);
    expect(profile).not.toMatch(/^SCAN user_voices$/m);
  });
});
