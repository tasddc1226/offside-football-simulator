import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../db/client.js';
import { listChangedNames, type WatchedName } from '../db/repos/nameWatch.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

// T-11-616 새 이름 점검이 읽는 "마지막 점검 뒤에 생기거나 바뀐 이름".

const T0 = new Date('2026-09-30T00:00:00.000Z');
const AUTH = { Authorization: 'Bearer agent-secret' };
type Body = { items: WatchedName[]; next: string; truncated: boolean };

describe('GET /v1/internal/agents/names (T-11-616)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson({ ...ctx.env, AGENTS_READ_TOKEN: 'agent-secret' }, method, path, opts);
  const names = async (query = '') => {
    const res = await call('GET', `/v1/internal/agents/names${query}`, { headers: AUTH });
    expect(res.status).toBe(200);
    return (await res.json()) as Body;
  };
  const later = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));
  const run = (sql: string, ...params: unknown[]) =>
    ctx.env.DB.prepare(sql)
      .bind(...params)
      .run();
  const putTeam = (cookie: string, body: Record<string, unknown>) =>
    call('PUT', '/v1/owner-team', {
      cookie,
      body: {
        name: '우리 FC',
        manager: '김감독',
        formation: '4-3-3',
        slots: Array(11).fill(null),
        ...body,
      },
    });

  it('토큰이 없거나 틀리면 주소가 없는 것처럼 404를 준다', async () => {
    const bare = await callJson(ctx.env, 'GET', '/v1/internal/agents/names', { headers: AUTH });
    expect(bare.status).toBe(404);
    const wrong = await call('GET', '/v1/internal/agents/names', {
      headers: { Authorization: 'Bearer nope' },
    });
    expect(wrong.status).toBe(404);
    expect((await call('GET', '/v1/internal/agents/names')).status).toBe(404);
  });

  it('닉네임을 정하거나 바꾸면 그 시각이 남고, 구단 이름 · 감독 이름이 바뀐 저장만 새 이름이 된다', async () => {
    const who = await issueGoogleCookie(ctx, { nickname: null });
    const nick = await call('PUT', '/v1/profile/nickname', {
      cookie: who.cookie,
      body: { nickname: '새닉네임' },
    });
    expect(nick.status).toBe(200);
    expect((await putTeam(who.cookie, {})).status).toBe(200);
    later(60_000);
    const first = await names();
    expect(first.items.map((i) => [i.kind, i.name, i.profileId === who.profileId])).toEqual([
      ['nickname', '새닉네임', true],
      ['team', '우리 FC', true],
      ['manager', '김감독', true],
    ]);
    expect(first.items.find((i) => i.kind === 'team')!.id).toMatch(/^tem_/);
    expect(first.truncated).toBe(false);

    // 다음 점검은 next부터 읽으니 이미 본 이름은 다시 나오지 않는다.
    later(60_000);
    expect((await names(`?since=${encodeURIComponent(first.next)}`)).items).toEqual([]);

    // 선발 · 포메이션만 고친 저장은 이름이 그대로라 새 이름이 아니다.
    expect((await putTeam(who.cookie, { formation: '4-4-2' })).status).toBe(200);
    later(60_000);
    expect((await names(`?since=${encodeURIComponent(first.next)}`)).items).toEqual([]);

    // 감독 이름만 바꾸면 감독 이름만 새로 나온다(구단 이름은 그대로라 같은 줄에 함께 실린다).
    expect((await putTeam(who.cookie, { manager: '박감독' })).status).toBe(200);
    expect(
      (
        await call('PUT', '/v1/profile/nickname', {
          cookie: who.cookie,
          body: { nickname: '바뀐닉' },
        })
      ).status,
    ).toBe(200);
    later(60_000);
    const changed = await names(`?since=${encodeURIComponent(first.next)}`);
    expect(changed.items.map((i) => [i.kind, i.name])).toEqual([
      ['nickname', '바뀐닉'],
      ['team', '우리 FC'],
      ['manager', '박감독'],
    ]);
  });

  it('막 쓴 이름(30초 안)은 건너뛰고, 가린 이름 · 삭제한 프로필 · 옛 행(null)은 읽지 않는다', async () => {
    const at = (s: number) => new Date(T0.getTime() + s * 1000).toISOString();
    await run(
      `INSERT INTO profiles(id,settings_json,created_at,last_seen_at,nickname,nickname_set_at,deleted_at)
       VALUES ('p_ok','{}',?1,?1,'정상',?2,NULL),
              ('p_new','{}',?1,?1,'방금',?3,NULL),
              ('p_del','{}',?1,?1,'삭제됨',?2,?1),
              ('p_old','{}',?1,?1,'옛닉네임',NULL,NULL)`,
      at(-1000),
      at(10),
      at(80),
    );
    await run(
      `INSERT INTO owner_teams(id,profile_id,season,name,manager,formation,slots_json,filled,ovr,created_at,updated_at,name_changed_at)
       VALUES ('tem_hidden','p_ok',0,'이름 가린 구단','익명 감독','4-4-2','[]',0,0,?1,?1,?2),
              ('tem_old','p_ok',1,'옛 구단','','4-4-1-1','[]',0,0,?1,?1,NULL)`,
      at(-1000),
      at(20),
    );
    later(100_000);
    const body = await names();
    expect(body.items.map((i) => i.name)).toEqual(['정상']);
    later(60_000);
    expect((await names()).items.map((i) => i.name)).toEqual(['정상', '방금']);
  });

  it('한도를 넘으면 읽은 데까지만 주고, 같은 시각 행은 잘리지 않게 다음으로 미룬다', async () => {
    const at = (s: number) => new Date(T0.getTime() + s * 1000).toISOString();
    const rows = [
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 3],
      ['e', 4],
    ] as const;
    for (const [id, s] of rows)
      await run(
        `INSERT INTO profiles(id,settings_json,created_at,last_seen_at,nickname,nickname_set_at)
         VALUES (?1,'{}',?2,?2,?3,?4)`,
        `p_${id}`,
        at(-1000),
        `닉${id}`,
        at(s),
      );
    later(200_000);
    const page = await names('?limit=3');
    // c · d가 같은 시각이라 한도 끝(3번째)에 걸친 c도 다음으로 미룬다.
    expect(page.items.map((i) => i.name)).toEqual(['닉a', '닉b']);
    expect(page.truncated).toBe(true);
    expect(page.next).toBe(at(2));
    const rest = await names(`?limit=3&since=${encodeURIComponent(page.next)}`);
    expect(rest.items.map((i) => i.name)).toEqual(['닉c', '닉d', '닉e']);
    expect(rest.truncated).toBe(false);
  });

  it('프로필 · 구단을 인덱스 범위로만 읽고 다른 표는 건드리지 않는다', async () => {
    const plan = async (sql: string) =>
      (
        await ctx.env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
          .bind('a', 'b')
          .all<{ detail: string }>()
      ).results
        .map((r) => r.detail)
        .join(' | ');
    expect(
      await plan(
        'SELECT id FROM profiles WHERE nickname_set_at IS NOT NULL AND nickname_set_at > ?1 AND nickname_set_at <= ?2 AND nickname IS NOT NULL AND deleted_at IS NULL ORDER BY nickname_set_at LIMIT 10',
      ),
    ).toContain('profiles_nickname_set_idx');
    expect(
      await plan(
        'SELECT id FROM owner_teams WHERE name_changed_at IS NOT NULL AND name_changed_at > ?1 AND name_changed_at <= ?2 ORDER BY name_changed_at LIMIT 10',
      ),
    ).toContain('owner_teams_name_changed_idx');
    const spy = spyDb(ctx.env.DB);
    await listChangedNames(
      createDb(spy.DB),
      T0.toISOString(),
      new Date(T0.getTime() + 1000).toISOString(),
      10,
    );
    expect(spy.seen.every((sql) => /from "(profiles|owner_teams)"/i.test(sql))).toBe(true);
    expect(spy.seen).toHaveLength(2);
  });
});
