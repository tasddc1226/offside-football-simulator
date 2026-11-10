import {
  CLUB_CUSTOM_IMG_MAX,
  CLUB_CUSTOM_IMG_TOTAL_MAX,
  ClubCustomResponseSchema,
  ErrorEnvelopeSchema,
  successEnvelope,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLUB_LOGO_MOVE_KEY, moveClubLogos } from '../cron/clubLogoMove.js';
import { clubLogoPrefix, deleteClubLogos } from '../db/repos/clubCustom.js';
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

  it('T-11-156: ?since=가 저장된 updatedAt과 같으면 clubs를 비워 보내고, 다르면 전부 보낸다', async () => {
    const { cookie } = await issueCookie(ctx);
    const at = '2026-09-25T00:00:00.000Z';
    await put(ctx, cookie, { clubs: CLUBS, updatedAt: at });
    const since = (s: string) =>
      callJson(ctx.env, 'GET', `/v1/club-custom?since=${encodeURIComponent(s)}`, { cookie });
    expect(Res.parse(await (await since(at)).json()).data).toEqual({ clubs: {}, updatedAt: at });
    expect(Res.parse(await (await since('2026-09-24T00:00:00.000Z')).json()).data).toEqual({
      clubs: CLUBS,
      updatedAt: at,
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

  it('이미지 합계가 한도를 넘으면 VALIDATION_FAILED, 한도 안이면 저장한다(T-11-599 이 경로는 요청 본문 1MiB를 넘어도 받는다)', async () => {
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

  it('T-11-599 새 리그까지 모든 클럽(302개)에 엠블럼 이미지를 넣어도 저장한다', async () => {
    const { cookie } = await issueCookie(ctx);
    // 운영 공유 에디트 파일의 64px 엠블럼 한 장은 약 4,100자다.
    const img = `data:image/webp;base64,${'A'.repeat(4_100)}`;
    const clubs = Object.fromEntries(
      Array.from({ length: 302 }, (_, i) => [
        `lg${i % 17}-${i}`,
        { name: '새 리그 클럽', logo: { text: 'A', bg: '#000000', fg: '#ffffff', img } },
      ]),
    );
    const res = await put(ctx, cookie, { clubs, updatedAt: '2026-10-31T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(Object.keys(Res.parse(await res.json()).data.clubs)).toHaveLength(302);
  });

  it('다른 경로는 요청 본문 1MiB 한도를 그대로 둔다', async () => {
    const { cookie } = await issueCookie(ctx);
    const res = await putJson(ctx, cookie, '/v1/profile/settings', { pad: 'A'.repeat(1_100_000) });
    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('VALIDATION_FAILED');
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

describe('구단 엠블럼 이미지 R2 보관 (T-11-683)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  const IMG = `data:image/png;base64,${'A'.repeat(400)}`;
  const IMG2 = `data:image/webp;base64,${'B'.repeat(400)}`;
  const WITH_IMG = {
    'pl-0': { name: '우리 동네 FC', logo: { text: '우', bg: '#112233', fg: '#ffffff', img: IMG } },
    'pl-1': { logo: { text: 'A', bg: '#000000', fg: '#ffffff' } },
    'k1-3': { name: '서울 불꽃' },
  };
  const row = async (profileId: string) =>
    (await ctx.db.select().from(clubCustoms).where(eq(clubCustoms.profileId, profileId)))[0]!;
  const keys = async (profileId: string) =>
    (
      await ctx.env.BACKUP!.list({ prefix: clubLogoPrefix(ctx.env.ENVIRONMENT, profileId) })
    ).objects.map((o) => o.key);
  const getData = async (cookie: string) => Res.parse(await (await get(ctx, cookie)).json()).data;

  it('이미지는 R2에, 이름 · 글자 · 색은 D1에 두고 조회는 합쳐서 돌려준다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const at = '2026-11-10T00:00:00.000Z';
    const res = await put(ctx, cookie, { clubs: WITH_IMG, updatedAt: at });
    expect(Res.parse(await res.json()).data).toEqual({ clubs: WITH_IMG, updatedAt: at });
    const saved = await row(profileId);
    expect(saved.clubsJson).not.toContain('base64');
    expect(JSON.parse(saved.clubsJson)['pl-0']).toEqual({
      name: '우리 동네 FC',
      logo: { text: '우', bg: '#112233', fg: '#ffffff' },
    });
    expect(await keys(profileId)).toEqual([saved.imgKey]);
    expect(await (await ctx.env.BACKUP!.get(saved.imgKey!))!.json()).toEqual({ 'pl-0': IMG });
    expect(await getData(cookie)).toEqual({ clubs: WITH_IMG, updatedAt: at });
  });

  it('이미지가 없으면 객체를 만들지 않는다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    await put(ctx, cookie, { clubs: CLUBS, updatedAt: '2026-11-10T00:00:00.000Z' });
    expect((await row(profileId)).imgKey).toBe('');
    expect(await keys(profileId)).toEqual([]);
  });

  it('?since=가 같으면 R2를 읽지 않는다(객체가 없어도 200)', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const at = '2026-11-10T00:00:00.000Z';
    await put(ctx, cookie, { clubs: WITH_IMG, updatedAt: at });
    await ctx.env.BACKUP!.delete((await row(profileId)).imgKey!);
    const same = await callJson(ctx.env, 'GET', `/v1/club-custom?since=${encodeURIComponent(at)}`, {
      cookie,
    });
    expect(Res.parse(await same.json()).data).toEqual({ clubs: {}, updatedAt: at });
    // 이미지 객체를 못 읽으면 이미지 빠진 값을 주지 않고 실패한다(기기가 받아 다시 올리면 이미지가 사라진다).
    const res = await get(ctx, cookie);
    expect(res.status).toBe(503);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('늦게 온 옛 쓰기는 무시하고 그 쓰기가 올린 객체를 남기지 않는다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const at = '2026-11-10T10:00:00.000Z';
    await put(ctx, cookie, { clubs: WITH_IMG, updatedAt: at });
    const kept = (await row(profileId)).imgKey;
    const stale = await put(ctx, cookie, {
      clubs: { 'pl-0': { logo: { text: 'X', bg: '#000000', fg: '#ffffff', img: IMG2 } } },
      updatedAt: '2026-11-10T09:00:00.000Z',
    });
    expect(Res.parse(await stale.json()).data).toEqual({ clubs: WITH_IMG, updatedAt: at });
    expect(await keys(profileId)).toEqual([kept]);
  });

  it('새로 저장하면 행은 새 객체를 가리키고, 갓 올린 옛 객체는 유예 뒤에 지운다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    await put(ctx, cookie, { clubs: WITH_IMG, updatedAt: '2026-11-10T10:00:00.000Z' });
    const first = (await row(profileId)).imgKey!;
    const next = { 'pl-0': { logo: { text: 'X', bg: '#000000', fg: '#ffffff', img: IMG2 } } };
    await put(ctx, cookie, { clubs: next, updatedAt: '2026-11-10T11:00:00.000Z' });
    const second = (await row(profileId)).imgKey!;
    expect(second).not.toBe(first);
    expect((await getData(cookie)).clubs).toEqual(next);
    // 유예(1시간) 안이라 옛 객체가 아직 있다. 시간이 지난 뒤의 저장이 지운다.
    expect((await keys(profileId)).sort()).toEqual([first, second].sort());
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 2 * 60 * 60_000);
    await put(ctx, cookie, { clubs: CLUBS, updatedAt: '2026-11-10T12:00:00.000Z' });
    spy.mockRestore();
    expect((await row(profileId)).imgKey).toBe('');
    expect(await keys(profileId)).toEqual([]);
  });

  it('옛 형식 행(이미지가 D1 안)도 그대로 읽고, 채우기가 R2로 옮긴다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    const at = '2026-10-01T00:00:00.000Z';
    for (const [id, clubs] of [
      [a.profileId, WITH_IMG],
      [b.profileId, CLUBS],
    ] as const)
      await ctx.db
        .insert(clubCustoms)
        .values({ profileId: id, clubsJson: JSON.stringify(clubs), updatedAt: at });
    expect(await getData(a.cookie)).toEqual({ clubs: WITH_IMG, updatedAt: at });

    const first = await moveClubLogos(ctx.env, 1);
    expect(first).toMatchObject({ done: false });
    const done = await moveClubLogos(ctx.env, 5);
    expect(done).toMatchObject({ done: true, moved: 1, empty: 1, skipped: 0 });
    // 끝난 뒤에는 표를 다시 읽지 않는다.
    expect(await moveClubLogos(ctx.env, 5)).toEqual(done);
    expect(
      await ctx.env.DB.prepare('SELECT 1 FROM app_meta WHERE key=?1')
        .bind(CLUB_LOGO_MOVE_KEY)
        .first(),
    ).not.toBeNull();

    const moved = await row(a.profileId);
    expect(moved.clubsJson).not.toContain('base64');
    expect(moved.updatedAt).toBe(at);
    expect(await keys(a.profileId)).toEqual([moved.imgKey]);
    expect((await row(b.profileId)).imgKey).toBe('');
    expect(await getData(a.cookie)).toEqual({ clubs: WITH_IMG, updatedAt: at });
    expect(await getData(b.cookie)).toEqual({ clubs: CLUBS, updatedAt: at });
  });

  it('CLUB_LOGO_R2_DISABLED=1이면 옛 형식으로 쓰고 채우기도 쉰다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    ctx.env.CLUB_LOGO_R2_DISABLED = '1';
    const at = '2026-11-10T00:00:00.000Z';
    await put(ctx, cookie, { clubs: WITH_IMG, updatedAt: at });
    const saved = await row(profileId);
    expect(saved.imgKey).toBeNull();
    expect(saved.clubsJson).toContain('base64');
    expect(await moveClubLogos(ctx.env)).toBe('skipped');
    expect(await getData(cookie)).toEqual({ clubs: WITH_IMG, updatedAt: at });
  });

  it('프로필을 지우면 그 프로필의 이미지 객체도 지운다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    for (const x of [a, b])
      await put(ctx, x.cookie, { clubs: WITH_IMG, updatedAt: '2026-11-10T00:00:00.000Z' });
    await deleteClubLogos(
      { bucket: ctx.env.BACKUP!, environment: ctx.env.ENVIRONMENT },
      a.profileId,
    );
    expect(await keys(a.profileId)).toEqual([]);
    expect(await keys(b.profileId)).toHaveLength(1);
  });
});
