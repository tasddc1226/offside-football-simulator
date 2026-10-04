import {
  ErrorEnvelopeSchema,
  MyCareersResponseSchema,
  RetirementResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { UPLOAD_LIMIT } from './careers.js';
import { authAttempts, careers, careerSeasons, profiles } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  deleteProfile,
  issueCookie,
  ORIGIN,
  putJson,
  putSeasonsFor,
  TEST_CAREER,
} from '../test/http.js';

function jsonInit(input: {
  method: 'PUT' | 'POST';
  body?: unknown;
  cookie?: string;
  origin?: string | null;
}): RequestInit {
  const { method, body, cookie, origin = ORIGIN } = input;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  return { method, headers, body: JSON.stringify(body ?? {}) };
}

const CAREER_ID = '9f2c9b1a-6f0f-4a4b-9c3a-1e2f3a4b5c6d';

function seasonBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    career: TEST_CAREER,
    season: {
      age: 18,
      club: '테스트 FC',
      league: '고교리그',
      apps: 20,
      goals: 10,
      assists: 3,
      rating: 7.2,
      rank: 1,
      ovr: 60,
      honors: ['고교리그 우승'],
    },
    events: [{ k: 'ev', id: 'rookie-1', c: 0, ok: true, h: 1 }],
    ...overrides,
  };
}

function retirementBody() {
  return {
    retireAge: 34,
    peak: 88,
    legendScore: 420,
    apps: 300,
    goals: 120,
    assists: 60,
    trophies: 4,
    awards: 2,
    caps: 30,
    ballon: 0,
    lastClub: '테스트 FC',
  };
}

describe('PUT /v1/careers/:careerId/seasons/:year', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('T-10-006: 시즌 상세(무실점·리그 기록·A매치·대회별·커리어 하이)를 저장한다', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();
    const detail = {
      cs: 12,
      lgApps: 18,
      lgGoals: 8,
      caps: 3,
      comps: [{ type: 'cup', name: '코리아컵', stage: '8강', apps: 2, g: 2, a: 1 }],
      ch: ['goals', 'cs'],
    };
    const body = seasonBody();
    const res = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({
        method: 'PUT',
        body: { ...body, season: { ...body.season, ...detail } },
        cookie: owner.cookie,
      }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const [row] = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(row).toMatchObject({ cs: 12, lgApps: 18, lgGoals: 8, caps: 3 });
    expect(JSON.parse(row!.compsJson!)).toEqual(detail.comps);
    expect(JSON.parse(row!.chJson!)).toEqual(detail.ch);
  });

  it('T-10-006: 대회 기록 형식이 틀리면 400', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();
    const body = seasonBody();
    const res = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({
        method: 'PUT',
        body: {
          ...body,
          season: {
            ...body.season,
            comps: [{ type: 'league', name: 'x', stage: '', apps: 1, g: 0, a: 0 }],
          },
        },
        cookie: owner.cookie,
      }),
      ctx.env,
    );
    expect(res.status).toBe(400);
  });

  it('T-10-066: 클럽 id를 저장하고, id 없는 옛 클라이언트의 은퇴 재전송은 저장된 id를 지우지 않는다', async () => {
    const { cookie } = await issueCookie(ctx);
    const put = (path: string, body: unknown) => putJson(ctx, cookie, path, body);
    const body = seasonBody();
    expect(
      (
        await put(`/v1/careers/${CAREER_ID}/seasons/2026`, {
          ...body,
          season: { ...body.season, clubId: 'pl-15' },
        })
      ).status,
    ).toBe(200);
    const [season] = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(season?.clubId).toBe('pl-15');

    await putSeasonsFor(ctx.env, cookie, CAREER_ID, retirementBody());
    expect(
      (
        await put(`/v1/careers/${CAREER_ID}/retirement`, {
          ...retirementBody(),
          lastClubId: 'pl-15',
        })
      ).status,
    ).toBe(200);
    expect((await put(`/v1/careers/${CAREER_ID}/retirement`, retirementBody())).status).toBe(200);
    const [row] = await ctx.db.select().from(careers).where(eq(careers.id, CAREER_ID));
    expect(row?.lastClubId).toBe('pl-15');
  });

  it('T-11-037: 나이별 OVR 상한을 크게 넘은 시즌은 잘라 저장하고 커리어를 숨긴다', async () => {
    const { cookie } = await issueCookie(ctx);
    const put = (path: string, body: unknown) => putJson(ctx, cookie, path, body);
    const body = seasonBody();
    const rowOf = async () =>
      (await ctx.db.select().from(careers).where(eq(careers.id, CAREER_ID)))[0]!;
    // 18세 상한(81)에 딱 붙은 값은 정상이다.
    expect(
      (
        await put(`/v1/careers/${CAREER_ID}/seasons/2026`, {
          ...body,
          season: { ...body.season, ovr: 81 },
        })
      ).status,
    ).toBe(200);
    expect((await rowOf()).hidden).toBe(0);
    expect(
      (
        await put(`/v1/careers/${CAREER_ID}/seasons/2027`, {
          ...body,
          season: { ...body.season, ovr: 86 },
        })
      ).status,
    ).toBe(200);
    expect((await rowOf()).hidden).toBe(1);
  });

  it('T-11-030: 처음 스카우트 평가는 한 번만 저장하고, 은퇴 때 실제 잠재력을 저장한다', async () => {
    const { cookie } = await issueCookie(ctx);
    const put = (path: string, body: unknown) => putJson(ctx, cookie, path, body);
    const base = seasonBody();
    const withPot = (pot: unknown) => ({ ...base, career: { ...base.career, pot } });
    // pot 없이 먼저 올라온 옛 기록 → 나중에 pot이 오면 채운다 → 그다음 값은 무시한다.
    expect((await put(`/v1/careers/${CAREER_ID}/seasons/2026`, base)).status).toBe(200);
    const potOf = async () =>
      (await ctx.db.select().from(careers).where(eq(careers.id, CAREER_ID)))[0]!;
    expect((await potOf()).pot).toBeNull();
    expect((await put(`/v1/careers/${CAREER_ID}/seasons/2026`, withPot(78))).status).toBe(200);
    expect((await put(`/v1/careers/${CAREER_ID}/seasons/2027`, withPot(90))).status).toBe(200);
    expect((await potOf()).pot).toBe(78);
    // 범위 밖·잘못된 모양은 기록을 막지 않고 버린다.
    expect((await put(`/v1/careers/${CAREER_ID}/seasons/2028`, withPot(500))).status).toBe(200);
    expect((await potOf()).pot).toBe(78);

    await putSeasonsFor(ctx.env, cookie, CAREER_ID, retirementBody());
    expect(
      (await put(`/v1/careers/${CAREER_ID}/retirement`, { ...retirementBody(), potReal: 84 }))
        .status,
    ).toBe(200);
    expect((await potOf()).potReal).toBe(84);
  });

  it('T-10-066: 클럽 id 형식이 틀리면 400', async () => {
    const { cookie } = await issueCookie(ctx);
    const body = seasonBody();
    const res = await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/seasons/2026`, {
      ...body,
      season: { ...body.season, clubId: '<script>' },
    });
    expect(res.status).toBe(400);
  });

  it('T-11-040: 프로필당 시간당 시즌 업로드 한도를 넘으면 429, 다른 프로필은 영향이 없다', async () => {
    const heavy = await issueCookie(ctx);
    const other = await issueCookie(ctx);
    const app = createApp();
    const put = (cookie: string, careerId: string) =>
      app.request(
        `/v1/careers/${careerId}/seasons/2026`,
        jsonInit({ method: 'PUT', body: seasonBody(), cookie }),
        ctx.env,
      );
    // 한도 직전까지 쓴 상태를 바로 만든다 — 120번 PUT은 느리다. 그 한 번은 통과하고 다음부터 429다.
    expect((await put(heavy.cookie, CAREER_ID)).status).toBe(200);
    await ctx.db
      .update(authAttempts)
      .set({ count: UPLOAD_LIMIT.CAREER_SEASON - 1 })
      .where(
        and(eq(authAttempts.kind, 'CAREER_SEASON'), eq(authAttempts.subject, heavy.profileId)),
      );
    expect((await put(heavy.cookie, CAREER_ID)).status).toBe(200);
    const limited = await put(heavy.cookie, CAREER_ID);
    expect(limited.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await limited.json()).error).toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
    });
    const otherId = '7a1c9b1a-6f0f-4a4b-9c3a-1e2f3a4b5c6e';
    expect((await put(other.cookie, otherId)).status).toBe(200);
  });

  it('T-11-048: 시즌 성장 기록을 저장하고, 기록 없이 다시 올라온 같은 시즌은 지우지 않는다', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();
    const growth = {
      v: 1,
      o0: 52,
      ph: [52, 54, 55],
      a0: [50, 51, 52, 53, 54, 55],
      a1: [52, 53, 54, 55, 56, 57],
      s0: [50.5, 51],
      s1: [52.5, 53],
      pot: { s: 74, b: 1, bl: -2.4, r: 0 },
    };
    const send = (extra: Record<string, unknown>) => {
      const b = seasonBody();
      return app.request(
        `/v1/careers/${CAREER_ID}/seasons/2026`,
        jsonInit({
          method: 'PUT',
          body: { ...b, season: { ...b.season, ...extra } },
          cookie: owner.cookie,
        }),
        ctx.env,
      );
    };
    const row = async () =>
      (await ctx.db.select().from(careerSeasons).where(eq(careerSeasons.careerId, CAREER_ID)))[0]!;

    expect((await send({ growth })).status).toBe(200);
    expect(JSON.parse((await row()).growthJson!)).toEqual(growth);

    // 옛 시즌 재전송(성장 기록 없음)은 이미 쌓인 기록을 그대로 둔다.
    expect((await send({})).status).toBe(200);
    expect(JSON.parse((await row()).growthJson!)).toEqual(growth);

    // 새 성장 기록이 오면 덮어쓴다.
    expect((await send({ growth: { ...growth, o0: 53 } })).status).toBe(200);
    expect(JSON.parse((await row()).growthJson!).o0).toBe(53);
  });

  it('T-11-048: 성장 기록 없이 올라온 첫 시즌은 NULL이고, 모양이 틀린 기록은 버리되 시즌은 받는다', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();
    const b = seasonBody();
    const res = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({ method: 'PUT', body: b, cookie: owner.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const [r] = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(r!.growthJson).toBeNull();
    // 모양이 틀린 성장 기록은 시즌을 막지 않고 이 값만 버린다.
    const bad = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2027`,
      jsonInit({
        method: 'PUT',
        body: { ...b, season: { ...b.season, growth: { v: 2, o0: 50 } } },
        cookie: owner.cookie,
      }),
      ctx.env,
    );
    expect(bad.status).toBe(200);
    const rows = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(rows.map((x) => x.growthJson)).toEqual([null, null]);
  });

  it('happy path: 시즌 upsert 후 은퇴까지 정상 처리된다', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({ method: 'PUT', body: seasonBody(), cookie: owner.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { careerId: string; year: number; status: string } };
    expect(body.data).toEqual({ careerId: CAREER_ID, year: 2026, status: 'active' });

    const careerRows = await ctx.db.select().from(careers).where(eq(careers.id, CAREER_ID));
    expect(careerRows).toHaveLength(1);
    expect(careerRows[0]?.status).toBe('active');
    expect(careerRows[0]?.profileId).toBe(owner.profileId);

    const seasonRows = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0]?.goals).toBe(10);
    // T-10-006: 상세 필드가 없는 옛 페이로드는 NULL로 남는다.
    expect(seasonRows[0]?.cs).toBeNull();
    expect(seasonRows[0]?.clubId).toBeNull();
    expect(seasonRows[0]?.compsJson).toBeNull();

    await putSeasonsFor(ctx.env, owner.cookie, CAREER_ID, retirementBody());
    const retireRes = await app.request(
      `/v1/careers/${CAREER_ID}/retirement`,
      jsonInit({ method: 'PUT', body: retirementBody(), cookie: owner.cookie }),
      ctx.env,
    );
    expect(retireRes.status).toBe(200);
    const retireBody = (await retireRes.json()) as { data: { careerId: string; status: string } };
    expect(retireBody.data).toEqual({
      careerId: CAREER_ID,
      status: 'retired',
      retiredNumber: null,
      serviceSeason: expect.any(Number),
    });

    const retiredRow = (await ctx.db.select().from(careers).where(eq(careers.id, CAREER_ID)))[0];
    expect(retiredRow?.status).toBe('retired');
    expect(retiredRow?.legendScore).toBe(420);

    // 은퇴 후 예전 시즌을 다시 PUT해도 active로 되돌아가지 않는다.
    const staleSeasonRes = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({ method: 'PUT', body: seasonBody(), cookie: owner.cookie }),
      ctx.env,
    );
    expect(staleSeasonRes.status).toBe(200);
    const stillRetired = (await ctx.db.select().from(careers).where(eq(careers.id, CAREER_ID)))[0];
    expect(stillRetired?.status).toBe('retired');
    // 은퇴 요약의 근거인 시즌 기록도 고쳐지지 않는다.
    const [kept] = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(kept?.goals).toBe(8);
  });

  it('다른 프로필 소유의 careerId를 쓰면 409 CAREER_OWNER_MISMATCH', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();
    await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({ method: 'PUT', body: seasonBody(), cookie: owner.cookie }),
      ctx.env,
    );

    const intruder = await issueCookie(ctx);
    const res = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2027`,
      jsonInit({ method: 'PUT', body: seasonBody(), cookie: intruder.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(409);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('CAREER_OWNER_MISMATCH');
  });

  it('honors 배열이 30개를 넘으면 400 VALIDATION_FAILED', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({
        method: 'PUT',
        body: seasonBody({
          season: {
            ...seasonBody().season,
            honors: Array.from({ length: 31 }, (_, i) => `honor-${i}`),
          },
        }),
        cookie: owner.cookie,
      }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('프로필 삭제 시 careers·career_seasons가 함께 삭제된다', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();
    await app.request(
      `/v1/careers/${CAREER_ID}/seasons/2026`,
      jsonInit({ method: 'PUT', body: seasonBody(), cookie: owner.cookie }),
      ctx.env,
    );

    expect((await deleteProfile(ctx.env, owner.cookie, 'idem-del')).status).toBe(204);

    const careerRows = await ctx.db
      .select()
      .from(careers)
      .where(eq(careers.profileId, owner.profileId));
    expect(careerRows).toHaveLength(0);
    const seasonRows = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(seasonRows).toHaveLength(0);
  });
});

describe('GET /v1/careers/mine (T-10-013)', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  async function retire(cookie: string, careerId: string, legendScore: number, retireAge?: number) {
    const app = createApp();
    const body = { ...retirementBody(), legendScore, ...(retireAge ? { retireAge } : {}) };
    await putSeasonsFor(ctx.env, cookie, careerId, body);
    expect(
      (
        await app.request(
          `/v1/careers/${careerId}/retirement`,
          jsonInit({ method: 'PUT', body, cookie }),
          ctx.env,
        )
      ).status,
    ).toBe(200);
  }
  async function mine(cookie?: string) {
    const app = createApp();
    return app.request('/v1/careers/mine', cookie ? { headers: { Cookie: cookie } } : {}, ctx.env);
  }

  it('세션이 없으면 401', async () => {
    expect((await mine()).status).toBe(401);
  });

  it('익명 프로필은 linked=false, 목록은 비운다(웹은 기기 기록을 쓴다)', async () => {
    const me = await issueCookie(ctx);
    await retire(me.cookie, CAREER_ID, 300);
    const res = await mine(me.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(successEnvelope(MyCareersResponseSchema).parse(await res.json()).data).toEqual({
      linked: false,
      entries: [],
    });
  });

  it('계정에 연결된 프로필은 자기 은퇴 선수만 점수순으로 받는다', async () => {
    const me = await issueCookie(ctx);
    const other = await issueCookie(ctx);
    await ctx.db.update(profiles).set({ googleSub: 'sub-me' }).where(eq(profiles.id, me.profileId));
    const low = '11111111-1111-4111-8111-111111111111';
    const high = '22222222-2222-4222-8222-222222222222';
    await retire(me.cookie, low, 100);
    await retire(me.cookie, high, 300, 22); // 짧은 커리어도 내 선수에는 남는다(T-10-032).
    await retire(other.cookie, '33333333-3333-4333-8333-333333333333', 900);
    // 은퇴하지 않은 커리어는 빠진다.
    const app = createApp();
    await app.request(
      '/v1/careers/44444444-4444-4444-8444-444444444444/seasons/2026',
      jsonInit({ method: 'PUT', body: seasonBody(), cookie: me.cookie }),
      ctx.env,
    );

    const data = successEnvelope(MyCareersResponseSchema).parse(
      await (await mine(me.cookie)).json(),
    ).data;
    expect(data.linked).toBe(true);
    expect(data.entries.map((e) => [e.id, e.legendScore])).toEqual([
      [high, 300],
      [low, 100],
    ]);
  });

  it('T-11-029: 내 선수 항목과 은퇴 응답이 선수의 서비스 시즌(0 = 프리시즌)을 알려 준다', async () => {
    const me = await issueCookie(ctx);
    await ctx.db.update(profiles).set({ googleSub: 'sub-me' }).where(eq(profiles.id, me.profileId));
    const pre = '55555555-5555-4555-8555-555555555555';
    const s1 = '66666666-6666-4666-8666-666666666666';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z')); // 프리시즌
    await putSeasonsFor(ctx.env, me.cookie, pre, retirementBody());
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
    await putSeasonsFor(ctx.env, me.cookie, s1, retirementBody());
    // 프리시즌 선수가 시즌 중에 은퇴해도 시즌은 첫 업로드 때 정해진 그대로다.
    const retireRes = async (id: string) =>
      successEnvelope(RetirementResponseSchema).parse(
        await (
          await createApp().request(
            `/v1/careers/${id}/retirement`,
            jsonInit({
              method: 'PUT',
              body: { ...retirementBody(), legendScore: id === pre ? 100 : 200 },
              cookie: me.cookie,
            }),
            ctx.env,
          )
        ).json(),
      ).data;
    expect((await retireRes(pre)).serviceSeason).toBe(0);
    expect((await retireRes(s1)).serviceSeason).toBe(1);

    const data = successEnvelope(MyCareersResponseSchema).parse(
      await (await mine(me.cookie)).json(),
    ).data;
    expect(Object.fromEntries(data.entries.map((e) => [e.id, e.season]))).toEqual({
      [pre]: 0,
      [s1]: 1,
    });
  });
});

// 브라우저에서 값을 고쳐 보낸 기록이 서버 기록·순위를 부풀리지 못한다.
describe('조작된 기록 보정', () => {
  let ctx: TestD1;
  let cookie: string;
  const put = (path: string, body: unknown) => putJson(ctx, cookie, path, body);
  const row = async () =>
    (await ctx.db.select().from(careers).where(eq(careers.id, CAREER_ID)))[0]!;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('게임에서 나올 수 없는 시즌 값은 거부하지 않고 잘라서 저장한다', async () => {
    const body = seasonBody();
    const res = await put(`/v1/careers/${CAREER_ID}/seasons/2026`, {
      ...body,
      season: {
        ...body.season,
        age: 99,
        clubId: 'pl-999',
        apps: 900,
        goals: 1000,
        assists: 1000,
        cs: 1000,
        caps: 200,
        ovr: 200,
        honors: [...Array.from({ length: 25 }, (_, i) => `상 ${i}`), '상 0', ' 상 1 '],
      },
    });
    expect(res.status).toBe(200);
    const [s] = await ctx.db
      .select()
      .from(careerSeasons)
      .where(eq(careerSeasons.careerId, CAREER_ID));
    expect(s).toMatchObject({
      age: 45,
      clubId: null,
      apps: 80,
      goals: 100,
      assists: 80,
      cs: 60,
      caps: 30,
      ovr: 99,
    });
    const honors = JSON.parse(s!.honorsJson) as string[];
    expect(honors).toHaveLength(20);
    expect(new Set(honors).size).toBe(20);
  });

  it('T-11-024: 입력 없이 시즌만 올라온(자동 플레이) 커리어는 공개 순위에서 빼고, 사람 입력이 있으면 그대로 둔다', async () => {
    const signals = (clicks: number) => ({
      ms: 14_000,
      clicks,
      keys: 0,
      touches: 0,
      moves: 0,
      synthetic: 0,
      hiddenMs: 0,
      webdriver: false,
    });
    const upload = (careerId: string, clicks: number) =>
      [2026, 2027].map(async (year) => {
        const body = seasonBody({ signals: signals(clicks) });
        return put(`/v1/careers/${careerId}/seasons/${year}`, {
          ...body,
          season: { ...body.season, age: 29 + year - 2026 },
        });
      });
    const idle = CAREER_ID;
    const human = '1b6f3c52-0d6e-4a9e-8c1a-6c7a2d1f9e10';
    for (const r of await Promise.all(upload(idle, 0))) expect(r.status).toBe(200);
    for (const r of await Promise.all(upload(human, 14))) expect(r.status).toBe(200);
    const hiddenOf = async (id: string) =>
      (await ctx.db.select().from(careers).where(eq(careers.id, id)))[0]!.hidden;
    expect(await hiddenOf(idle)).toBe(1);
    expect(await hiddenOf(human)).toBe(0);

    expect((await put(`/v1/careers/${idle}/retirement`, retirementBody())).status).toBe(200);
    expect((await put(`/v1/careers/${human}/retirement`, retirementBody())).status).toBe(200);
    const list = await createApp().request('/v1/hof', {}, ctx.env);
    const ids = ((await list.json()) as { data: { entries: { id: string }[] } }).data.entries.map(
      (e) => e.id,
    );
    expect(ids).toContain(human);
    expect(ids).not.toContain(idle);
  });

  it('포지션·유형 같은 커리어 메타는 처음 값을 지킨다', async () => {
    await put(`/v1/careers/${CAREER_ID}/seasons/2026`, seasonBody());
    await put(`/v1/careers/${CAREER_ID}/seasons/2027`, {
      ...seasonBody(),
      career: { ...TEST_CAREER, pos: 'GK', type: 'wall', appVersion: '1.0.1' },
    });
    expect(await row()).toMatchObject({ pos: 'FW', type: 'poacher', appVersion: '1.0.1' });
  });

  it('T-10-091: 세부 포지션은 처음 값을 지키고, 큰 포지션과 어긋나면 버린다', async () => {
    await put(`/v1/careers/${CAREER_ID}/seasons/2026`, {
      ...seasonBody(),
      career: { ...TEST_CAREER, dpos: 'W' },
    });
    await put(`/v1/careers/${CAREER_ID}/seasons/2027`, {
      ...seasonBody(),
      career: { ...TEST_CAREER, dpos: 'ST' },
    });
    expect(await row()).toMatchObject({ pos: 'FW', dpos: 'W' });

    const other = '55555555-5555-4555-8555-555555555555';
    await put(`/v1/careers/${other}/seasons/2026`, {
      ...seasonBody(),
      career: { ...TEST_CAREER, dpos: 'CB' },
    });
    const [r] = await ctx.db.select().from(careers).where(eq(careers.id, other));
    expect(r).toMatchObject({ pos: 'FW', dpos: null });
    expect(
      (
        await put(`/v1/careers/${other}/seasons/2027`, {
          ...seasonBody(),
          career: { ...TEST_CAREER, dpos: 'LW' },
        })
      ).status,
    ).toBe(400);
  });

  it('T-10-092: 최고 시점 능력치는 자리별 실력을 최고 OVR 아래로 잘라 남기고, 모양이 틀려도 은퇴는 받는다', async () => {
    await putSeasonsFor(ctx.env, cookie, CAREER_ID, { ...retirementBody(), retireAge: 25 });
    const profile = {
      attrs: { pac: 91, sho: 70, pas: 66, dri: 80, def: 40, phy: 72 },
      roles: { GK: 20, CB: 45, FB: 60, DM: 55, CM: 64, AM: 75, W: 99, ST: 86 },
    };
    const res = await put(`/v1/careers/${CAREER_ID}/retirement`, {
      ...retirementBody(),
      peak: 150,
      profile,
    });
    expect(res.status).toBe(200);
    const r = await row();
    expect(r.peak).toBe(88);
    expect(JSON.parse(r.peakProfile!)).toEqual({
      attrs: profile.attrs,
      roles: { ...profile.roles, W: 88 },
    });

    const other = '66666666-6666-4666-8666-666666666666';
    await putSeasonsFor(ctx.env, cookie, other, { ...retirementBody(), retireAge: 25 });
    const bad = await put(`/v1/careers/${other}/retirement`, {
      ...retirementBody(),
      profile: { attrs: {}, roles: { ST: 'x' } },
    });
    expect(bad.status).toBe(200);
    const [o] = await ctx.db.select().from(careers).where(eq(careers.id, other));
    expect(o).toMatchObject({ status: 'retired', peakProfile: null });
  });

  it('은퇴 요약은 받아 둔 시즌 기록에 맞추고, 레전드 점수는 그 기록으로 낼 수 있는 만큼만 받는다', async () => {
    await putSeasonsFor(ctx.env, cookie, CAREER_ID, { ...retirementBody(), retireAge: 25 });
    const res = await put(`/v1/careers/${CAREER_ID}/retirement`, {
      ...retirementBody(),
      retireAge: 40,
      legendScore: 99_999,
      apps: 99_999,
      goals: 99_999,
      assists: 99_999,
      trophies: 9_999,
      awards: 9_999,
      caps: 9_999,
      ballon: 999,
      peak: 150,
      lastClubId: 'zz-1',
    });
    expect(res.status).toBe(200);
    const r = await row();
    // 18–24세 7시즌: 출전·골·도움은 시즌 합계, 우승·수상은 시즌 영예(6개) + 여유 3, A매치는 시즌 합계.
    expect(r).toMatchObject({
      retireAge: 25,
      apps: 300,
      goals: 120,
      assists: 60,
      trophies: 9,
      awards: 0,
      caps: 30,
      ballon: 0,
      peak: 88,
      lastClubId: null,
    });
    // 120×0.42 + 60×0.35 + 300×0.05 + 9×10 + 30×0.4 + 88×2 + 7시즌×30×0.6 = 490.4
    expect(r.legendScore).toBe(491);
  });

  it('은퇴를 다시 보내면 공개 이름만 바뀌고 요약은 첫 은퇴 그대로다', async () => {
    await putSeasonsFor(ctx.env, cookie, CAREER_ID, retirementBody());
    await put(`/v1/careers/${CAREER_ID}/retirement`, retirementBody());
    const res = await put(`/v1/careers/${CAREER_ID}/retirement`, {
      ...retirementBody(),
      legendScore: 1,
      goals: 1,
      publicName: '김오프',
    });
    expect(res.status).toBe(200);
    expect(await row()).toMatchObject({ legendScore: 420, goals: 120, publicName: '김오프' });
  });

  it('받아 둔 시즌이 없는 커리어의 은퇴는 400', async () => {
    const other = '0d000000-0000-4000-8000-000000000001';
    await put(`/v1/careers/${other}/seasons/2026`, seasonBody());
    await ctx.db.delete(careerSeasons).where(eq(careerSeasons.careerId, other));
    const res = await put(`/v1/careers/${other}/retirement`, retirementBody());
    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.details).toMatchObject({
      reason: 'NO_SEASONS',
    });
  });
});

describe('T-11-063 개막 첫 업로드 경계', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  it('개막 직전/정각의 첫 업로드를 구분하고 늦은 재전송이 소속 시즌을 바꾸지 않는다', async () => {
    const me = await issueCookie(ctx);
    const app = createApp();
    const pre = '77777777-7777-4777-8777-777777777777';
    const s1 = '88888888-8888-4888-8888-888888888888';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T14:59:59.999Z'));
    const upload = async (id: string, body = seasonBody()) => {
      const res = await app.request(
        `/v1/careers/${id}/seasons/2026`,
        jsonInit({ method: 'PUT', body, cookie: me.cookie }),
        ctx.env,
      );
      expect(res.status).toBe(200);
    };
    await upload(pre);
    vi.setSystemTime(new Date('2026-10-05T15:00:00.000Z'));
    await upload(s1, seasonBody({ career: { ...TEST_CAREER, dpos: 'ST' } }));
    await upload(pre);
    const rows = await ctx.db
      .select({ id: careers.id, season: careers.serviceSeason, dpos: careers.dpos })
      .from(careers);
    expect(Object.fromEntries(rows.map((r) => [r.id, [r.season, r.dpos]]))).toEqual({
      [pre]: [0, null],
      [s1]: [1, 'ST'],
    });
  });
});
