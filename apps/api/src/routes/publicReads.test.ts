import { BOARD_KEYS, BOARD_PAGE_LIMIT } from '@offside/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { issueCookie } from '../test/http.js';

// T-10-015 공개 GET은 엣지 캐시에 담기므로 쿠키가 있어도 보는 사람의 세션을 읽으면 안 된다(누구에게나 같은 응답).
// 랭킹은 회원 팀만 거르려고 profiles를 조인하므로 profiles는 막지 않는다.
// 개인화가 섞인 팀 프로필·게시글 상세(/v1/teams/:id, /v1/boards/posts/:id)는 세션을 읽는다 — 여기 넣지 않는다.
const PUBLIC_GETS = [
  '/v1/health',
  '/v1/app/version',
  '/v1/hof',
  '/v1/hof?sort=goals&page=2',
  '/v1/hof/3b1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b',
  '/v1/firsts',
  '/v1/firsts?lang=en',
  '/v1/retired-numbers',
  '/v1/balance',
  '/v1/live',
  '/v1/ticker',
  '/v1/ticker?lang=en',
  '/v1/teams',
  '/v1/teams?lang=en',
  '/v1/achievements/ranking',
  ...BOARD_KEYS.map((b) => `/v1/boards/${b}/posts?limit=${BOARD_PAGE_LIMIT}`),
];

describe('공개 GET은 쿠키가 있어도 세션을 읽지 않는다', () => {
  let ctx: TestD1;
  let cookie: string;

  // 읽기만 하므로 D1 하나를 모든 경로가 함께 쓴다.
  beforeAll(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
  });
  afterAll(() => ctx.dispose());

  it.each(PUBLIC_GETS)('%s', async (path) => {
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await createApp().request(
      path,
      { headers: { Cookie: cookie } },
      { ...ctx.env, DB },
    );
    expect(res.status).toBeLessThan(500);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(seen.filter((q) => /"sessions"/.test(q))).toEqual([]);
  });
});
