import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie, putJson, seasonBody } from '../test/http.js';
import { cards, careerRenames, careers, ownerItems } from '../db/schema.js';
import { updateRetired } from '../db/repos/careers.js';
import { careersByIds, publicNamesOf } from '../db/repos/ownerTeams.js';
import { getNameTarget } from '../db/repos/nameReports.js';

// T-11-377 선수 이름 변경권.
const ID = '00000000-0000-4000-8000-000000000761';
const FRESH = '00000000-0000-4000-8000-000000000762';
const ORPHAN = '00000000-0000-4000-8000-000000000763';
describe('POST /v1/careers/:careerId/rename', () => {
  let ctx: TestD1;
  let raiser: Awaited<ReturnType<typeof issueGoogleCookie>>;
  let buyer: Awaited<ReturnType<typeof issueGoogleCookie>>;
  let n = 0;
  const rename = (cookie: string, name: string, id = ID, key = `rename-key-${++n}`) =>
    callJson(ctx.env, 'POST', `/v1/careers/${id}/rename`, {
      cookie,
      body: { name },
      headers: { 'Idempotency-Key': key },
    });
  const give = (profileId: string, qty: number) =>
    ctx.env.DB.prepare(
      `INSERT INTO owner_items (profile_id, item, qty, updated_at) VALUES (?, 'rename', ?, '2026-10-18')
       ON CONFLICT (profile_id, item) DO UPDATE SET qty = excluded.qty`,
    )
      .bind(profileId, qty)
      .run();
  const qtyOf = async (profileId: string) =>
    (await ctx.db.select().from(ownerItems).where(eq(ownerItems.profileId, profileId))).find(
      (r) => r.item === 'rename',
    )?.qty ?? 0;
  const nameOf = async () =>
    (await ctx.db.select().from(careers).where(eq(careers.id, ID)))[0]?.publicName;
  const reason = async (res: Response) =>
    ((await res.json()) as { error: { details?: { reason?: string } } }).error.details?.reason;

  beforeAll(async () => {
    ctx = await createTestD1();
    raiser = await issueGoogleCookie(ctx);
    buyer = await issueGoogleCookie(ctx);
    expect(
      (await putJson(ctx, raiser.cookie, `/v1/careers/${ID}/seasons/2026`, seasonBody())).status,
    ).toBe(200);
  });
  beforeEach(async () => {
    await ctx.db.delete(cards);
    await ctx.db.delete(careerRenames);
    await ctx.db
      .update(careers)
      .set({ status: 'retired', publicName: '옛이름', nameHiddenAt: null })
      .where(eq(careers.id, ID));
    await give(raiser.profileId, 2);
    await give(buyer.profileId, 2);
  });
  afterAll(async () => ctx?.dispose());

  it('키운 사람이 한 장으로 이름을 바꾸고 기록을 남긴다(같은 멱등 키 재시도는 한 장만)', async () => {
    const first = await rename(raiser.cookie, '  새이름 ', ID, 'rename-same-key');
    expect(first.status).toBe(200);
    expect(((await first.json()) as { data: unknown }).data).toEqual({
      careerId: ID,
      name: '새이름',
      rename: 1,
    });
    expect((await rename(raiser.cookie, '  새이름 ', ID, 'rename-same-key')).status).toBe(200);
    expect(await nameOf()).toBe('새이름');
    expect(await qtyOf(raiser.profileId)).toBe(1);
    const logs = await ctx.db.select().from(careerRenames);
    expect(logs).toMatchObject([
      { careerId: ID, profileId: raiser.profileId, oldName: '옛이름', newName: '새이름' },
    ]);
  });

  it('T-11-548 키운 사람이 계정을 지워 기록이 없는 카드는 카드에 이름을 붙이고 팀 · 경기 기록 · 신고가 그 이름을 쓴다', async () => {
    await ctx.env.DB.prepare(
      `INSERT INTO cards (career_id, owner_id, service_season, pos, peak, legend_score, retire_value, transfers, created_at, updated_at)
       VALUES (?, ?, 1, 'FW', 99, 100, 0, 3, '2026-10-18', '2026-10-18')`,
    )
      .bind(ORPHAN, buyer.profileId)
      .run();
    expect((await careersByIds(ctx.db, [ORPHAN]))[0]?.publicName).toBeNull();
    expect(await reason(await rename(raiser.cookie, '남의카드', ORPHAN))).toBe('NOT_MINE');
    expect((await rename(buyer.cookie, '포를란', ORPHAN)).status).toBe(200);
    expect(await qtyOf(buyer.profileId)).toBe(1);
    expect((await careersByIds(ctx.db, [ORPHAN]))[0]?.publicName).toBe('포를란');
    expect((await publicNamesOf(ctx.db, [ORPHAN, ID])).get(ORPHAN)).toBe('포를란');
    // T-11-555 경기 기록 선수가 50명을 넘어도 한 문장의 변수 100개 한도에 걸리지 않는다.
    const many = [
      ORPHAN,
      ...Array.from(
        { length: 119 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      ),
    ];
    expect((await publicNamesOf(ctx.db, many)).get(ORPHAN)).toBe('포를란');
    expect(await getNameTarget(ctx.db, 'career', ORPHAN)).toEqual({
      ownerId: buyer.profileId,
      name: '포를란',
    });
    // 같은 이름은 장수를 빼지 않고, 다시 바꾸면 기록의 옛 이름은 카드 이름이다.
    expect(await reason(await rename(buyer.cookie, '포를란', ORPHAN))).toBe('SAME');
    expect((await rename(buyer.cookie, '디에고', ORPHAN)).status).toBe(200);
    expect(
      (await ctx.db.select().from(careerRenames).where(eq(careerRenames.careerId, ORPHAN))).map(
        (r) => [r.oldName, r.newName],
      ),
    ).toEqual([
      [null, '포를란'],
      ['포를란', '디에고'],
    ]);
    // 이름은 카드 칸에 남는다.
    expect(
      (await ctx.db.select().from(cards).where(eq(cards.careerId, ORPHAN)))[0]?.publicName,
    ).toBe('디에고');
  });

  it('이적시장에서 산 선수는 지금 카드 주인만 바꾼다', async () => {
    await ctx.env.DB.prepare(
      `INSERT INTO cards (career_id, owner_id, service_season, pos, peak, legend_score, retire_value, transfers, created_at, updated_at)
       VALUES (?, ?, 0, 'FW', 80, 100, 0, 1, '2026-10-18', '2026-10-18')`,
    )
      .bind(ID, buyer.profileId)
      .run();
    const notMine = await rename(raiser.cookie, '판선수');
    expect(notMine.status).toBe(409);
    expect(await reason(notMine)).toBe('NOT_MINE');
    expect((await rename(buyer.cookie, '산선수')).status).toBe(200);
    expect(await nameOf()).toBe('산선수');
    expect(await qtyOf(buyer.profileId)).toBe(1);
    expect(await qtyOf(raiser.profileId)).toBe(2);
  });

  it('남의 선수 · 가려진 이름 · 같은 이름 · 장수 없음 · 쓸 수 없는 이름은 장수를 빼지 않는다', async () => {
    expect(await reason(await rename(buyer.cookie, '남의선수'))).toBe('NOT_MINE');
    expect(await reason(await rename(raiser.cookie, '옛이름'))).toBe('SAME');
    expect(await reason(await rename(raiser.cookie, 'http://x.co'))).toBe('PUBLIC_NAME_REJECTED');
    expect((await rename(raiser.cookie, '열세글자이름입니다아아아아')).status).toBe(400);
    await ctx.db.update(careers).set({ nameHiddenAt: '2026-10-18' }).where(eq(careers.id, ID));
    expect(await reason(await rename(raiser.cookie, '가린뒤'))).toBe('HIDDEN');
    await ctx.db.update(careers).set({ nameHiddenAt: null }).where(eq(careers.id, ID));
    await give(raiser.profileId, 0);
    expect(await reason(await rename(raiser.cookie, '장수없음'))).toBe('NO_RENAME');
    expect(await nameOf()).toBe('옛이름');
    expect(await qtyOf(buyer.profileId)).toBe(2);
    expect(await ctx.db.select().from(careerRenames)).toEqual([]);
  });

  it('로그인하지 않은 기기는 403, 서버에 아직 없는 진행 중 커리어는 장수만 빼고 기록한다', async () => {
    const guest = await issueCookie(ctx);
    const res = await rename(guest.cookie, '손님');
    expect(res.status).toBe(403);
    expect(await reason(res)).toBe('GOOGLE_LOGIN_REQUIRED');
    const fresh = await rename(raiser.cookie, '새커리어', FRESH);
    expect(fresh.status).toBe(200);
    expect(await qtyOf(raiser.profileId)).toBe(1);
    expect(await ctx.db.select().from(careerRenames)).toMatchObject([
      { careerId: FRESH, oldName: null, newName: '새커리어' },
    ]);
  });

  it('은퇴 기록을 다시 보내도 공개한 이름은 다른 이름으로 바뀌지 않는다(비우기는 된다)', async () => {
    const now = '2026-10-18T00:00:00.000Z';
    await updateRetired(ctx.db, { careerId: ID, publicName: '공짜변경', title: null, now });
    expect(await nameOf()).toBe('옛이름');
    await updateRetired(ctx.db, { careerId: ID, publicName: null, title: null, now });
    expect(await nameOf()).toBeNull();
  });
});
