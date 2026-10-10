import { HIDDEN_MANAGER_NAME, HIDDEN_TEAM_NAME } from '@offside/contracts/board-limits';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, careers, nameReports, ownerTeams, profiles } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  callJson,
  deleteProfile,
  issueAdminCookie,
  issueCookie,
  issueGoogleCookie,
  seasonBody,
} from '../test/http.js';

describe('이름 신고 /v1/reports/names', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(env, method, path, opts);
  const now = '2026-09-28T00:00:00.000Z';

  async function addCareer(profileId: string, publicName: string | null) {
    const id = crypto.randomUUID();
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'active',
      appVersion: '1.0.0',
      publicName,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }
  async function addTeam(profileId: string) {
    const id = `tm_${crypto.randomUUID()}`;
    await ctx.db.insert(ownerTeams).values({
      id,
      profileId,
      name: '나쁜 구단',
      manager: '나쁜 감독',
      formation: '4-3-3',
      slotsJson: '[]',
      filled: 0,
      ovr: 0,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }
  const report = (cookie: string | undefined, kind: string, id: string) =>
    call('POST', '/v1/reports/names', { ...(cookie ? { cookie } : {}), body: { kind, id } });
  const openReports = async (cookie: string) =>
    (
      (await (await call('GET', '/v1/admin/name-reports', { cookie })).json()) as {
        data: { items: { kind: string; targetId: string; name: string | null; reports: number }[] };
      }
    ).data.items;
  const resolve = (cookie: string, kind: string, id: string, action: string) =>
    call('POST', '/v1/admin/name-reports/resolve', { cookie, body: { kind, id, action } });

  beforeEach(async () => {
    ctx = await createTestD1();
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('남의 공개 이름만 신고한다. 한 사람은 한 번만 세고, 관리자 목록에 대상마다 한 줄', async () => {
    const owner = await issueGoogleCookie(ctx, { nickname: '주인' });
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    const career = await addCareer(owner.profileId, '나쁜이름');
    const anonymous = await addCareer(owner.profileId, null);
    const team = await addTeam(owner.profileId);

    expect((await report(undefined, 'career', career)).status).toBe(401);
    expect((await report(a.cookie, 'club', career)).status).toBe(400);
    expect((await report(owner.cookie, 'career', career)).status).toBe(403);
    expect((await report(a.cookie, 'career', anonymous)).status).toBe(404); // 공개 이름 없음
    expect((await report(a.cookie, 'team', 'tm_none')).status).toBe(404);
    expect((await report(a.cookie, 'career', career)).status).toBe(204);
    expect((await report(a.cookie, 'career', career)).status).toBe(204); // 멱등
    expect((await report(b.cookie, 'career', career)).status).toBe(204);
    expect((await report(a.cookie, 'team', team)).status).toBe(204);

    const admin = await issueAdminCookie(ctx);
    expect((await call('GET', '/v1/admin/name-reports', { cookie: a.cookie })).status).toBe(403);
    const items = await openReports(admin.cookie);
    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'career', targetId: career, name: '나쁜이름', reports: 2 }),
        expect.objectContaining({ kind: 'team', targetId: team, name: '나쁜 구단 · 나쁜 감독' }),
      ]),
    );
  });

  it('가리기: 선수 이름은 지우고 업로드가 다시 채우지 않는다. 구단은 가린 이름으로 바꾼다', async () => {
    const owner = await issueGoogleCookie(ctx, { nickname: '주인' });
    const a = await issueCookie(ctx);
    const admin = await issueAdminCookie(ctx);
    const career = await addCareer(owner.profileId, '나쁜이름');
    const team = await addTeam(owner.profileId);
    await report(a.cookie, 'career', career);
    await report(a.cookie, 'team', team);

    expect((await resolve(a.cookie, 'career', career, 'hide')).status).toBe(403);
    expect((await resolve(admin.cookie, 'career', career, 'hide')).status).toBe(204);
    expect((await resolve(admin.cookie, 'career', career, 'hide')).status).toBe(404); // 이미 닫힘
    expect((await resolve(admin.cookie, 'team', team, 'hide')).status).toBe(204);

    const [c] = await ctx.db.select().from(careers).where(eq(careers.id, career));
    expect(c).toMatchObject({ publicName: null });
    expect(c?.nameHiddenAt).toBeTruthy();
    const [t] = await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, team));
    expect(t).toMatchObject({ name: HIDDEN_TEAM_NAME, manager: HIDDEN_MANAGER_NAME });
    expect(await openReports(admin.cookie)).toHaveLength(0);
    expect(
      (await ctx.db.select().from(auditLog).where(eq(auditLog.kind, 'NAME_REPORT_RESOLVED')))
        .length,
    ).toBe(2);

    // 주인이 다시 올려도 가린 이름은 돌아오지 않는다.
    const res = await call('PUT', `/v1/careers/${career}/seasons/2026`, {
      cookie: owner.cookie,
      body: { ...seasonBody(), publicName: '나쁜이름' },
    });
    expect(res.status).toBe(200);
    const [after] = await ctx.db.select().from(careers).where(eq(careers.id, career));
    expect(after?.publicName).toBeNull();

    // 가린 뒤 다시 신고하면(이름 없음) 404.
    expect((await report(a.cookie, 'career', career)).status).toBe(404);
  });

  it('T-11-167 업적 랭킹 닉네임(owner): 구단 id로 신고하고, 가리면 구단주 닉네임을 비운다', async () => {
    const owner = await issueGoogleCookie(ctx, { nickname: '나쁜닉' });
    const a = await issueCookie(ctx);
    const admin = await issueAdminCookie(ctx);
    const team = await addTeam(owner.profileId);
    expect((await report(owner.cookie, 'owner', team)).status).toBe(403);
    expect((await report(a.cookie, 'owner', team)).status).toBe(204);
    expect(await openReports(admin.cookie)).toEqual([
      expect.objectContaining({ kind: 'owner', targetId: team, name: '나쁜닉', reports: 1 }),
    ]);
    expect((await resolve(admin.cookie, 'owner', team, 'hide')).status).toBe(204);
    const [p] = await ctx.db.select().from(profiles).where(eq(profiles.id, owner.profileId));
    expect(p?.nickname).toBeNull();
    const [t] = await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, team));
    expect(t?.name).toBe('나쁜 구단'); // 구단 이름은 그대로
    expect((await report(a.cookie, 'owner', team)).status).toBe(404); // 닉네임 없음
  });

  it('기각: 이름은 그대로 두고 닫는다. 같은 사람이 다시 신고하면 다시 열린다', async () => {
    const owner = await issueGoogleCookie(ctx, { nickname: '주인' });
    const a = await issueCookie(ctx);
    const admin = await issueAdminCookie(ctx);
    const career = await addCareer(owner.profileId, '괜찮은이름');
    await report(a.cookie, 'career', career);
    expect((await resolve(admin.cookie, 'career', career, 'dismiss')).status).toBe(204);
    const [c] = await ctx.db.select().from(careers).where(eq(careers.id, career));
    expect(c).toMatchObject({ publicName: '괜찮은이름', nameHiddenAt: null });
    expect(await openReports(admin.cookie)).toHaveLength(0);
    await report(a.cookie, 'career', career);
    expect(await openReports(admin.cookie)).toMatchObject([{ targetId: career, reports: 1 }]);
  });

  it('프로필을 지우면 그 사람이 한 신고와 그 사람의 이름이 받은 신고가 지워진다', async () => {
    const owner = await issueGoogleCookie(ctx, { nickname: '주인' });
    const other = await issueGoogleCookie(ctx, { nickname: '남' });
    const a = await issueCookie(ctx);
    await report(a.cookie, 'career', await addCareer(owner.profileId, '이름'));
    await report(a.cookie, 'team', await addTeam(owner.profileId));
    await report(a.cookie, 'career', await addCareer(other.profileId, '남 이름'));
    await report(owner.cookie, 'career', await addCareer(other.profileId, '남 이름2'));
    expect(await ctx.db.select().from(nameReports)).toHaveLength(4);
    expect((await deleteProfile(env, owner.cookie, 'idem-name-report-del')).status).toBe(204);
    expect(await ctx.db.select().from(nameReports)).toMatchObject([{ profileId: a.profileId }]);
  });
});
