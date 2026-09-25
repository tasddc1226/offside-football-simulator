import { ErrorEnvelopeSchema, MyCareersResponseSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { careers, careerSeasons, profiles } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function extractSessionToken(setCookie: string): string {
  const token = /offside_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) throw new Error('Set-Cookie에 offside_session이 없습니다.');
  return token;
}

async function issueCookie(ctx: TestD1): Promise<{ profileId: string; cookie: string }> {
  const app = createApp();
  const res = await app.request('/v1/profile', {}, ctx.env);
  const token = extractSessionToken(res.headers.get('Set-Cookie') ?? '');
  const body = successEnvelope(ProfileSchema).parse(await res.json());
  return { profileId: body.data.id, cookie: `offside_session=${token}` };
}

function jsonInit(input: { method: 'PUT' | 'POST'; body?: unknown; cookie?: string; origin?: string | null }): RequestInit {
  const { method, body, cookie, origin = ALLOWED_ORIGIN } = input;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  return { method, headers, body: JSON.stringify(body ?? {}) };
}

const CAREER_ID = '9f2c9b1a-6f0f-4a4b-9c3a-1e2f3a4b5c6d';

function seasonBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    career: { pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late', startYear: 2026, appVersion: '1.0.0' },
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
      jsonInit({ method: 'PUT', body: { ...body, season: { ...body.season, ...detail } }, cookie: owner.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const [row] = await ctx.db.select().from(careerSeasons).where(eq(careerSeasons.careerId, CAREER_ID));
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
      jsonInit({ method: 'PUT', body: { ...body, season: { ...body.season, comps: [{ type: 'league', name: 'x', stage: '', apps: 1, g: 0, a: 0 }] } }, cookie: owner.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(400);
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

    const seasonRows = await ctx.db.select().from(careerSeasons).where(eq(careerSeasons.careerId, CAREER_ID));
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0]?.goals).toBe(10);
    // T-10-006: 상세 필드가 없는 옛 페이로드는 NULL로 남는다.
    expect(seasonRows[0]?.cs).toBeNull();
    expect(seasonRows[0]?.compsJson).toBeNull();

    const retireRes = await app.request(
      `/v1/careers/${CAREER_ID}/retirement`,
      jsonInit({ method: 'PUT', body: retirementBody(), cookie: owner.cookie }),
      ctx.env,
    );
    expect(retireRes.status).toBe(200);
    const retireBody = (await retireRes.json()) as { data: { careerId: string; status: string } };
    expect(retireBody.data).toEqual({ careerId: CAREER_ID, status: 'retired' });

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
        body: seasonBody({ season: { ...seasonBody().season, honors: Array.from({ length: 31 }, (_, i) => `honor-${i}`) } }),
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

    const tokenRes = await app.request(
      '/v1/profile/delete',
      { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN, Cookie: owner.cookie, 'Idempotency-Key': 'idem-del-token' }, body: '{}' },
      ctx.env,
    );
    const { data: tokenData } = (await tokenRes.json()) as { data: { confirmToken: string } };
    const confirmRes = await app.request(
      '/v1/profile/delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN, Cookie: owner.cookie, 'Idempotency-Key': 'idem-del-confirm' },
        body: JSON.stringify({ confirmToken: tokenData.confirmToken }),
      },
      ctx.env,
    );
    expect(confirmRes.status).toBe(204);

    const careerRows = await ctx.db.select().from(careers).where(eq(careers.profileId, owner.profileId));
    expect(careerRows).toHaveLength(0);
    const seasonRows = await ctx.db.select().from(careerSeasons).where(eq(careerSeasons.careerId, CAREER_ID));
    expect(seasonRows).toHaveLength(0);
  });
});

describe('GET /v1/careers/mine (T-10-013)', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  async function retire(cookie: string, careerId: string, legendScore: number) {
    const app = createApp();
    expect((await app.request(`/v1/careers/${careerId}/seasons/2026`, jsonInit({ method: 'PUT', body: seasonBody(), cookie }), ctx.env)).status).toBe(200);
    const body = { ...retirementBody(), legendScore };
    expect((await app.request(`/v1/careers/${careerId}/retirement`, jsonInit({ method: 'PUT', body, cookie }), ctx.env)).status).toBe(200);
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
    expect(successEnvelope(MyCareersResponseSchema).parse(await res.json()).data).toEqual({ linked: false, entries: [] });
  });

  it('계정에 연결된 프로필은 자기 은퇴 선수만 점수순으로 받는다', async () => {
    const me = await issueCookie(ctx);
    const other = await issueCookie(ctx);
    await ctx.db.update(profiles).set({ googleSub: 'sub-me' }).where(eq(profiles.id, me.profileId));
    const low = '11111111-1111-4111-8111-111111111111';
    const high = '22222222-2222-4222-8222-222222222222';
    await retire(me.cookie, low, 100);
    await retire(me.cookie, high, 500);
    await retire(other.cookie, '33333333-3333-4333-8333-333333333333', 900);
    // 은퇴하지 않은 커리어는 빠진다.
    const app = createApp();
    await app.request('/v1/careers/44444444-4444-4444-8444-444444444444/seasons/2026', jsonInit({ method: 'PUT', body: seasonBody(), cookie: me.cookie }), ctx.env);

    const data = successEnvelope(MyCareersResponseSchema).parse(await (await mine(me.cookie)).json()).data;
    expect(data.linked).toBe(true);
    expect(data.entries.map((e) => [e.id, e.legendScore])).toEqual([
      [high, 500],
      [low, 100],
    ]);
  });
});
