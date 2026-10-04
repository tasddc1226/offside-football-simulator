import {
  HofDetailResponseSchema,
  RetiredNumberCheckResponseSchema,
  RetiredNumbersResponseSchema,
  RetirementResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { ensureRetiredNumbersBackfilled } from '../db/repos/retiredNumbers.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { fakeHub } from '../test/liveHub.js';
import {
  callJson,
  deleteProfile,
  issueCookie,
  putJson,
  RETIREMENT,
  seasonBody,
} from '../test/http.js';

const A = '0c000000-0000-4000-8000-00000000000a';
const B = '0c000000-0000-4000-8000-00000000000b';
const C = '0c000000-0000-4000-8000-00000000000c';

// 프리미어리그 한 구단에서 8시즌 — 해마다 리그·챔스 우승 + 발롱도르(구단 기여 1,000점 넘게).
const legendSeason = (year: number, club: string, clubId?: string) => ({
  year,
  age: year - 2008,
  club,
  ...(clubId ? { clubId } : {}),
  league: '프리미어리그',
  apps: 38,
  goals: 30,
  assists: 10,
  cs: 0,
  rating: 7.8,
  rank: 1,
  ovr: 88,
  honors: ['프리미어리그 우승', 'UEFA 챔피언스리그 우승', '발롱도르'],
});
type Season = ReturnType<typeof legendSeason>;
const quietSeason = (year: number, club: string, clubId: string) => ({
  ...legendSeason(year, club, clubId),
  goals: 3,
  assists: 1,
  honors: [],
});
const years = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const snapshot = (number: number, career: Season[]) => ({
  number,
  pos: 'FW',
  age: 34,
  peak: 90,
  lastClub: '맨체스터 스카이블루',
  career,
  trophies: [],
  awards: [],
  ballon: [],
  nat: { caps: 0 },
  storyLog: [],
  miles: [],
});
const skyBlue = (number: number) =>
  snapshot(
    number,
    years(2030, 8).map((y) => legendSeason(y, '맨체스터 스카이블루', 'pl-0')),
  );
/** 스카이블루 8시즌 + 리버풀 더 레즈 8시즌(둘 다 자격). */
const twoClubs = (number: number) =>
  snapshot(number, [
    ...years(2030, 8).map((y) => legendSeason(y, '맨체스터 스카이블루', 'pl-0')),
    ...years(2038, 7).map((y) => legendSeason(y, '리버풀 더 레즈', 'pl-1')),
  ]);

// 시즌 기록을 수십 번 올리는 테스트가 있어 제한 시간을 늘린다.
describe('영구결번 (T-10-076)', () => {
  let ctx: TestD1;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  /** 시즌 기록을 올린다 — 판정은 서버가 받아 둔 시즌으로 한다(스냅샷은 보기용). */
  const putSeasons = async (id: string, seasons: Season[], who = cookie, env = ctx.env) => {
    for (const { year, ...season } of seasons) {
      const res = await callJson(env, 'PUT', `/v1/careers/${id}/seasons/${year}`, {
        cookie: who,
        body: { ...seasonBody(), season },
      });
      expect(res.status).toBe(200);
    }
  };
  const retire = async (
    id: string,
    snap: { career: Season[] },
    publicName: string | null,
    who = cookie,
    env = ctx.env,
  ) => {
    const put = (path: string, body: unknown) => callJson(env, 'PUT', path, { cookie: who, body });
    const { career } = snap;
    await putSeasons(id, career, who, env);
    const res = await put(`/v1/careers/${id}/retirement`, {
      ...RETIREMENT,
      retireAge: career.at(-1)!.age + 1,
      publicName,
      snapshot: snap,
    });
    expect(res.status).toBe(200);
    return successEnvelope(RetirementResponseSchema).parse(await res.json()).data.retiredNumber;
  };
  const list = async (env = ctx.env, query = '') => {
    const res = await createApp().request(`/v1/retired-numbers${query}`, {}, env);
    expect(res.status).toBe(200);
    return successEnvelope(RetiredNumbersResponseSchema).parse(await res.json()).data.items;
  };

  it('이름을 공개한 자격자는 결번을 받고, 명예의 전당 상세·목록에 보인다', async () => {
    expect(await retire(A, skyBlue(10), '김결번')).toMatchObject({
      kind: 'granted',
      clubId: 'pl-0',
      club: '맨체스터 스카이블루',
      number: 10,
      seq: 1,
    });
    expect(await list()).toMatchObject([{ careerId: A, name: '김결번', number: 10, seq: 1 }]);
    // 판정 기준(구단 기여 점수)은 서버 밖으로 내보내지 않는다.
    expect((await list())[0]).not.toHaveProperty('score');
    const res = await createApp().request(`/v1/hof/${A}`, {}, ctx.env);
    const detail = successEnvelope(HofDetailResponseSchema).parse(await res.json()).data;
    expect(detail.entry.retiredNumber).toEqual({
      clubId: 'pl-0',
      club: '맨체스터 스카이블루',
      number: 10,
      seq: 1,
    });
  });

  it('자리를 막 잡은 순간에만 앱을 열어 둔 브라우저에 알린다(재전송·익명·이미 찬 자리는 알리지 않는다)', async () => {
    const hub = fakeHub();
    const env = { ...ctx.env, LIVE: hub.ns };
    await retire(A, skyBlue(10), null, cookie, env);
    await retire(A, skyBlue(10), '김결번', cookie, env);
    await vi.waitFor(() => expect(hub.retiredNumbers).toHaveLength(1));
    expect(hub.retiredNumbers[0]).toEqual({
      careerId: A,
      name: '김결번',
      pos: 'FW',
      clubId: 'pl-0',
      club: '맨체스터 스카이블루',
      number: 10,
      seq: 1,
      season: expect.any(Number),
      at: expect.any(String),
    });
    await retire(A, skyBlue(10), '김결번', cookie, env);
    await retire(B, skyBlue(10), '늦은자', cookie, env);
    await new Promise((r) => setTimeout(r, 200));
    expect(hub.retiredNumbers).toHaveLength(1);
  });

  it('자리가 찼으면 두 번째 구단 번호를, 그마저 없으면 보유자를 알려 준다', async () => {
    await retire(A, twoClubs(10), '먼저온');
    expect(await retire(B, twoClubs(10), '두번째')).toMatchObject({
      kind: 'granted',
      clubId: 'pl-1',
      number: 10,
      seq: 2,
    });
    expect(await retire(C, skyBlue(10), '세번째')).toMatchObject({
      kind: 'taken',
      clubId: 'pl-0',
      number: 10,
      holder: '먼저온',
    });
    // 번호가 다르면 같은 구단이라도 받는다.
    const D = '0c000000-0000-4000-8000-00000000000d';
    expect(await retire(D, skyBlue(7), '일곱')).toMatchObject({ kind: 'granted', number: 7 });
  });

  it('익명이면 자리를 잡지 않고, 이름을 공개하는 순간 잡는다(나중에 숨겨도 유지)', async () => {
    expect(await retire(A, skyBlue(10), null)).toMatchObject({ kind: 'anonymous', number: 10 });
    expect(await list()).toEqual([]);
    expect(await retire(B, skyBlue(10), '공개함')).toMatchObject({ kind: 'granted' });
    // A가 뒤늦게 이름을 공개해도 먼저 공개한 B의 자리다.
    expect(await retire(A, skyBlue(10), '늦게공개')).toMatchObject({
      kind: 'taken',
      holder: '공개함',
    });
    expect(await retire(B, skyBlue(10), null)).toMatchObject({ kind: 'granted', seq: 1 });
  });

  it('기준에 못 미치거나 한 구단 시즌이 짧으면 null', async () => {
    const quiet = snapshot(
      9,
      years(2030, 10).map((y) => quietSeason(y, '맨체스터 스카이블루', 'pl-0')),
    );
    expect(await retire(A, quiet, '평범')).toBeNull();
    const short = snapshot(
      9,
      years(2030, 5).map((y) => legendSeason(y, '맨체스터 스카이블루', 'pl-0')),
    );
    expect(await retire(B, short, '짧음')).toBeNull();
  });

  it('보유자 프로필이 지워지면 자리가 빈다', async () => {
    const other = (await issueCookie(ctx)).cookie;
    await retire(A, skyBlue(10), '지울사람', other);
    expect((await deleteProfile(ctx.env, other, 'idem-rn-del')).status).toBe(204);
    expect(await list()).toEqual([]);
    expect(await retire(B, skyBlue(10), '다음')).toMatchObject({ kind: 'granted' });
  });

  it('처음 배포 때 기존 은퇴를 은퇴 시각 순서로 소급한다(옛 기록은 구단 이름·바꾼 이름으로 찾는다)', async () => {
    const other = (await issueCookie(ctx)).cookie;
    // 옛 기록: 시즌에 clubId가 없다. B는 구단 이름을 바꿔 뛰었다.
    const oldSky = snapshot(
      10,
      years(2030, 8).map((y) => legendSeason(y, '맨체스터 스카이블루')),
    );
    const renamed = snapshot(
      10,
      years(2030, 8).map((y) => legendSeason(y, '우리 시티')),
    );
    await retire(A, oldSky, '나중은퇴');
    await retire(B, renamed, '먼저은퇴', other);
    await putJson(ctx, other, '/v1/club-custom', {
      clubs: { 'pl-0': { name: '우리 시티' } },
      updatedAt: new Date().toISOString(),
    });
    // 규칙 도입 전 상태로 되돌리고, B가 먼저 은퇴한 것으로 바꾼다.
    const db = ctx.env.DB;
    await db.batch([
      db.prepare('DELETE FROM retired_numbers'),
      db.prepare("DELETE FROM app_meta WHERE key LIKE 'retired_numbers_%'"),
      db
        .prepare('UPDATE careers SET retired_at = ?1 WHERE id = ?2')
        .bind('2026-01-01T00:00:00.000Z', B),
    ]);
    expect(await ensureRetiredNumbersBackfilled(ctx.db, 1)).toBe(true);
    expect(await ensureRetiredNumbersBackfilled(ctx.db, 1)).toBe(true);
    expect(await ensureRetiredNumbersBackfilled(ctx.db, 1)).toBe(false);
    expect(await list()).toMatchObject([
      { careerId: B, clubId: 'pl-0', seq: 1, grantedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(await ensureRetiredNumbersBackfilled(ctx.db, 1)).toBe(false);
  });

  it('소급이 끝나기 전의 은퇴는 옛 은퇴가 먼저 자리를 잡은 뒤에 심사한다', async () => {
    const other = (await issueCookie(ctx)).cookie;
    await retire(B, skyBlue(10), '옛레전드', other);
    const db = ctx.env.DB;
    await db.batch([
      db.prepare('DELETE FROM retired_numbers'),
      db.prepare("DELETE FROM app_meta WHERE key LIKE 'retired_numbers_%'"),
    ]);
    expect(await retire(A, skyBlue(10), '새레전드')).toMatchObject({
      kind: 'taken',
      holder: '옛레전드',
    });
  });
  it('내 선수 심사 조회: 소급으로 받은 결번·이미 찬 자리를 알려 주고, 남의 커리어는 거부한다', async () => {
    const other = (await issueCookie(ctx)).cookie;
    await retire(B, skyBlue(10), '옛레전드', other);
    await retire(A, skyBlue(10), '새레전드');
    // 배포 전 은퇴처럼 응답을 못 받은 기록을 흉내 낸다 — 자리는 서버에만 있다.
    const check = async (id: string, who: string) => {
      const res = await callJson(ctx.env, 'GET', `/v1/careers/${id}/retired-number`, {
        cookie: who,
      });
      return { status: res.status, body: (await res.json()) as unknown };
    };
    const mine = await check(A, cookie);
    expect(mine.status).toBe(200);
    expect(
      successEnvelope(RetiredNumberCheckResponseSchema).parse(mine.body).data.retiredNumber,
    ).toMatchObject({ kind: 'taken', holder: '옛레전드' });
    const theirs = await check(B, other);
    expect(
      successEnvelope(RetiredNumberCheckResponseSchema).parse(theirs.body).data.retiredNumber,
    ).toMatchObject({ kind: 'granted', seq: 1 });
    expect((await check(B, cookie)).status).toBe(409);
  });
  it('스냅샷을 부풀려 보내도 받아 둔 시즌 기록으로 판정한다', async () => {
    const quiet = years(2030, 8).map((y) => quietSeason(y, '맨체스터 스카이블루', 'pl-0'));
    await putSeasons(A, quiet);
    const res = await callJson(ctx.env, 'PUT', `/v1/careers/${A}/retirement`, {
      cookie,
      body: { ...RETIREMENT, publicName: '부풀림', snapshot: skyBlue(10) },
    });
    expect(
      successEnvelope(RetirementResponseSchema).parse(await res.json()).data.retiredNumber,
    ).toBeNull();
    expect(await list()).toEqual([]);
  });

  it('은퇴 뒤에 덧붙인 시즌·게임에 없는 클럽 id는 세지 않는다', async () => {
    // 5시즌(자격 미달)으로 은퇴한 뒤 레전드 시즌을 덧붙이고 이름 공개로 다시 심사받는다.
    const five = snapshot(
      10,
      years(2030, 5).map((y) => legendSeason(y, '맨체스터 스카이블루', 'pl-0')),
    );
    expect(await retire(A, five, null)).toBeNull();
    await putSeasons(
      A,
      years(2035, 5).map((y) => legendSeason(y, '맨체스터 스카이블루', 'pl-0')),
    );
    expect(await retire(A, skyBlue(10), '덧붙임')).toBeNull();
    // 없는 클럽 id + 모르는 구단 이름은 어느 구단의 결번도 아니다.
    const fake = snapshot(
      10,
      years(2030, 8).map((y) => legendSeason(y, '가짜 구단', 'pl-99')),
    );
    expect(await retire(B, fake, '가짜')).toBeNull();
  });

  it('T-11-029: 시즌 1 선수는 프리시즌 선수와 같은 구단·번호의 결번을 받고, seq도 시즌마다 센다', async () => {
    const hub = fakeHub();
    const env = { ...ctx.env, LIVE: hub.ns };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z')); // 프리시즌
    expect(await retire(A, skyBlue(10), '프리시즌', cookie, env)).toMatchObject({
      kind: 'granted',
      number: 10,
      seq: 1,
    });
    expect(await retire(B, skyBlue(7), '프리일곱', cookie, env)).toMatchObject({ seq: 2 });
    // 개막 전 기본 목록은 프리시즌.
    expect(await list()).toMatchObject([{ careerId: A }, { careerId: B }]);

    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
    // 프리시즌 선수가 시즌 중에 자리를 차지했어도 시즌 1 선수가 같은 번호를 받는다.
    expect(await retire(C, skyBlue(10), '시즌일', cookie, env)).toMatchObject({
      kind: 'granted',
      clubId: 'pl-0',
      number: 10,
      seq: 1,
    });
    await vi.waitFor(() => expect(hub.retiredNumbers.map((r) => r.season)).toEqual([0, 0, 1]));
    // 시즌 안에서는 여전히 먼저 잡은 쪽이 영구 보유한다.
    const D = '0c000000-0000-4000-8000-00000000000d';
    expect(await retire(D, skyBlue(10), '시즌이', cookie, env)).toMatchObject({
      kind: 'taken',
      holder: '시즌일',
    });
    // 기본 목록은 지금 시즌, ?season=으로 프리시즌 목록.
    expect(await list()).toMatchObject([{ careerId: C, seq: 1 }]);
    expect(await list(ctx.env, '?season=1')).toMatchObject([{ careerId: C, seq: 1 }]);
    expect(await list(ctx.env, '?season=0')).toMatchObject([
      { careerId: A, seq: 1 },
      { careerId: B, seq: 2 },
    ]);
    const res = await createApp().request('/v1/retired-numbers?season=0', {}, ctx.env);
    expect(successEnvelope(RetiredNumbersResponseSchema).parse(await res.json()).data.season).toBe(
      0,
    );
    expect((await createApp().request('/v1/retired-numbers?season=9', {}, ctx.env)).status).toBe(
      400,
    );
    // 명예의 전당 상세의 결번은 그 선수 시즌 것이다.
    const detail = await createApp().request(`/v1/hof/${C}`, {}, ctx.env);
    expect(
      successEnvelope(HofDetailResponseSchema).parse(await detail.json()).data.entry.retiredNumber,
    ).toMatchObject({ number: 10, seq: 1 });
  });
});
