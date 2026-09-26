import {
  CLUB_CUSTOM_IMG_MAX,
  CLUB_CUSTOM_IMG_TOTAL_MAX,
  ClubCustomResponseSchema,
  ErrorEnvelopeSchema,
  successEnvelope,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clubCustoms } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, putJson } from '../test/http.js';

const Res = successEnvelope(ClubCustomResponseSchema);

const get = (ctx: TestD1, cookie?: string) =>
  callJson(ctx.env, 'GET', '/v1/club-custom', cookie ? { cookie } : {});
const put = (ctx: TestD1, cookie: string, body: unknown) =>
  putJson(ctx, cookie, '/v1/club-custom', body);

const CLUBS = {
  'pl-0': { name: '우리 동네 FC', logo: { text: '우', bg: '#112233', fg: '#ffffff' } },
  'k1-3': { name: '서울 불꽃' },
};

describe('/v1/club-custom (T-10-010)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('세션이 없으면 401 PROFILE_REQUIRED', async () => {
    const res = await get(ctx);
    expect(res.status).toBe(401);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('PROFILE_REQUIRED');
  });

  it('저장 전에는 빈 값, 저장 후에는 같은 값을 돌려준다', async () => {
    const { cookie } = await issueCookie(ctx);
    expect(Res.parse(await (await get(ctx, cookie)).json()).data).toEqual({
      clubs: {},
      updatedAt: null,
    });
    const r = await put(ctx, cookie, { clubs: CLUBS, updatedAt: '2026-09-25T00:00:00.000Z' });
    expect(r.status).toBe(200);
    expect(Res.parse(await (await get(ctx, cookie)).json()).data).toEqual({
      clubs: CLUBS,
      updatedAt: '2026-09-25T00:00:00.000Z',
    });
  });

  it('더 오래된 updatedAt의 쓰기는 무시하고 서버 값을 돌려준다(최신 쓰기 우선)', async () => {
    const { cookie } = await issueCookie(ctx);
    await put(ctx, cookie, { clubs: CLUBS, updatedAt: '2026-09-25T10:00:00.000Z' });
    const stale = await put(ctx, cookie, { clubs: {}, updatedAt: '2026-09-25T09:00:00.000Z' });
    expect(Res.parse(await stale.json()).data).toEqual({
      clubs: CLUBS,
      updatedAt: '2026-09-25T10:00:00.000Z',
    });
  });

  it('형식이 틀린 값(색·id·외부 이미지 URL)은 VALIDATION_FAILED', async () => {
    const { cookie } = await issueCookie(ctx);
    for (const clubs of [
      { 'pl-0': { logo: { text: 'A', bg: 'red', fg: '#ffffff' } } },
      { 'bad id': { name: 'x' } },
      {
        'pl-0': {
          logo: { text: 'A', bg: '#000000', fg: '#ffffff', img: 'https://evil.example/x.png' },
        },
      },
    ]) {
      const res = await put(ctx, cookie, { clubs, updatedAt: '2026-09-25T00:00:00.000Z' });
      expect(res.status).toBe(400);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('이미지 합계가 한도를 넘으면 VALIDATION_FAILED, 한도 안이면 저장한다(요청 본문 1MiB 안)', async () => {
    const { cookie } = await issueCookie(ctx);
    const img = `data:image/png;base64,${'A'.repeat(CLUB_CUSTOM_IMG_MAX - 30)}`;
    const many = (n: number) =>
      Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `pl-${i}`,
          { logo: { text: 'A', bg: '#000000', fg: '#ffffff', img } },
        ]),
      );
    const fits = Math.floor(CLUB_CUSTOM_IMG_TOTAL_MAX / img.length);
    const ok = await put(ctx, cookie, { clubs: many(fits), updatedAt: '2026-09-25T00:00:00.000Z' });
    expect(ok.status).toBe(200);
    const over = await put(ctx, cookie, {
      clubs: many(fits + 1),
      updatedAt: '2026-09-25T01:00:00.000Z',
    });
    expect(over.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await over.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('프로필 삭제 시 함께 지워진다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    await put(ctx, cookie, { clubs: CLUBS, updatedAt: '2026-09-25T00:00:00.000Z' });
    expect((await deleteProfile(ctx.env, cookie, 'idem-club-del')).status).toBe(204);
    expect(
      await ctx.db.select().from(clubCustoms).where(eq(clubCustoms.profileId, profileId)),
    ).toHaveLength(0);
  });
});
