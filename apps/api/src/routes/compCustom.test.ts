import { CompCustomResponseSchema, ErrorEnvelopeSchema, successEnvelope } from '@offside/contracts';
import { COMP_ICON_IMG_MAX } from '@offside/contracts/comp-custom-limits';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compIconPrefix, deleteClubLogos } from '../db/repos/clubCustom.js';
import { compCustoms } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, putJson } from '../test/http.js';

const Res = successEnvelope(CompCustomResponseSchema);
const get = (ctx: TestD1, cookie?: string, since?: string) =>
  callJson(
    ctx.env,
    'GET',
    `/v1/comp-custom${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    cookie ? { cookie } : {},
  );
const put = (ctx: TestD1, cookie: string, body: unknown) =>
  putJson(ctx, cookie, '/v1/comp-custom', body);

const IMG = `data:image/webp;base64,${'A'.repeat(400)}`;
const IMG2 = `data:image/png;base64,${'B'.repeat(400)}`;
const NAMES = { 코리아컵: '오프사이드컵', K리그1: '우리 리그' };
const ICONS = { 코리아컵: IMG };
const AT = '2026-11-10T00:00:00.000Z';

describe('/v1/comp-custom 대회 · 수상 이름과 리그 · 대회 로고 동기화 (T-11-684)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  const row = async (profileId: string) =>
    (await ctx.db.select().from(compCustoms).where(eq(compCustoms.profileId, profileId)))[0];
  const keys = async (profileId: string) =>
    (
      await ctx.env.BACKUP!.list({ prefix: compIconPrefix(ctx.env.ENVIRONMENT, profileId) })
    ).objects.map((o) => o.key);
  const data = async (res: Response) => Res.parse(await res.json()).data;

  it('세션이 없으면 401 PROFILE_REQUIRED', async () => {
    const res = await get(ctx);
    expect(res.status).toBe(401);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('PROFILE_REQUIRED');
  });

  it('저장한 적이 없으면 빈 값과 updatedAt null', async () => {
    const { cookie } = await issueCookie(ctx);
    expect(await data(await get(ctx, cookie))).toEqual({ names: {}, icons: {}, updatedAt: null });
  });

  it('이름은 D1에, 로고는 R2에 두고 조회는 합쳐서 돌려준다. 다른 프로필에는 보이지 않는다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const other = await issueCookie(ctx);
    const body = { names: NAMES, icons: ICONS, updatedAt: AT };
    expect(await data(await put(ctx, cookie, body))).toEqual(body);
    const saved = (await row(profileId))!;
    expect(JSON.parse(saved.namesJson)).toEqual(NAMES);
    expect(saved.iconsJson).toBe('{}');
    expect(await keys(profileId)).toEqual([saved.imgKey]);
    expect(await data(await get(ctx, cookie))).toEqual(body);
    expect(await data(await get(ctx, other.cookie))).toEqual({
      names: {},
      icons: {},
      updatedAt: null,
    });
  });

  it('?since=가 같으면 비워 보내고 R2를 읽지 않는다. 객체를 못 읽으면 503', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    await put(ctx, cookie, { names: NAMES, icons: ICONS, updatedAt: AT });
    await ctx.env.BACKUP!.delete((await row(profileId))!.imgKey!);
    expect(await data(await get(ctx, cookie, AT))).toEqual({ names: {}, icons: {}, updatedAt: AT });
    expect((await get(ctx, cookie)).status).toBe(503);
  });

  it('늦게 온 옛 쓰기는 무시하고 그 쓰기가 올린 객체를 남기지 않는다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const body = { names: NAMES, icons: ICONS, updatedAt: '2026-11-10T10:00:00.000Z' };
    await put(ctx, cookie, body);
    const kept = (await row(profileId))!.imgKey;
    const stale = await put(ctx, cookie, {
      names: {},
      icons: { 코리아컵: IMG2 },
      updatedAt: '2026-11-10T09:00:00.000Z',
    });
    expect(await data(stale)).toEqual(body);
    expect(await keys(profileId)).toEqual([kept]);
  });

  it('로고를 모두 지우면 객체를 만들지 않는다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    await put(ctx, cookie, { names: NAMES, icons: {}, updatedAt: AT });
    expect((await row(profileId))!.imgKey).toBe('');
    expect(await keys(profileId)).toEqual([]);
  });

  it('버킷을 쓰지 않으면(CLUB_LOGO_R2_DISABLED) 로고도 D1에 두고 그대로 읽는다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    ctx.env.CLUB_LOGO_R2_DISABLED = '1';
    const body = { names: NAMES, icons: ICONS, updatedAt: AT };
    await put(ctx, cookie, body);
    const saved = (await row(profileId))!;
    expect(saved.imgKey).toBeNull();
    expect(JSON.parse(saved.iconsJson)).toEqual(ICONS);
    expect(await data(await get(ctx, cookie))).toEqual(body);
  });

  it('한도를 넘거나 형식이 틀리면 400', async () => {
    const { cookie } = await issueCookie(ctx);
    const bad = [
      { names: { 코리아컵: 'x'.repeat(31) }, icons: {}, updatedAt: AT },
      { names: {}, icons: { 코리아컵: 'https://example.com/a.png' }, updatedAt: AT },
      {
        names: {},
        icons: { 코리아컵: `data:image/png;base64,${'A'.repeat(COMP_ICON_IMG_MAX)}` },
        updatedAt: AT,
      },
      { names: NAMES, updatedAt: AT },
    ];
    for (const body of bad) expect((await put(ctx, cookie, body)).status).toBe(400);
  });

  it('프로필을 지우면 행과 로고 객체를 지운다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    for (const x of [a, b]) await put(ctx, x.cookie, { names: NAMES, icons: ICONS, updatedAt: AT });
    await deleteClubLogos(
      { bucket: ctx.env.BACKUP!, environment: ctx.env.ENVIRONMENT },
      a.profileId,
    );
    expect(await keys(a.profileId)).toEqual([]);
    expect(await keys(b.profileId)).toHaveLength(1);
    expect((await deleteProfile(ctx.env, b.cookie, 'idem-comp-del')).status).toBe(204);
    expect(await row(b.profileId)).toBeUndefined();
  });
});
