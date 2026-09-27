import { ProfileSchema, successEnvelope } from '@offside/contracts';
import { createApp } from '../app.js';
import { SESSION_COOKIE_NAME } from '../auth/session.js';
import { linkGoogle, type TestD1 } from './d1.js';

// T-10-044: 라우트 테스트 공용 HTTP 헬퍼(12개 파일에 복사돼 있던 것을 모았다).

/** 테스트 요청의 브라우저 Origin — 로컬 개발 허용 목록에 들어 있다. */
export const ORIGIN = 'http://localhost:5173';

/** 브라우저처럼 JSON·Origin 헤더를 붙여 라우트를 부른다. GET이 아니면 본문(기본 {})을 보낸다. */
export function callJson(
  env: TestD1['env'],
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  return createApp().request(
    path,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
        ...opts.headers,
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(opts.body ?? {}) }),
    },
    env,
  );
}

/** 프로필 삭제 2단계(확인 토큰 → 확정)를 밟고 확정 응답을 돌려준다. 멱등 키는 `${key}-token`·`${key}-confirm`. */
export async function deleteProfile(env: TestD1['env'], cookie: string, key: string) {
  const tokenRes = await callJson(env, 'POST', '/v1/profile/delete', {
    cookie,
    headers: { 'Idempotency-Key': `${key}-token` },
  });
  const { confirmToken } = ((await tokenRes.json()) as { data: { confirmToken: string } }).data;
  return callJson(env, 'POST', '/v1/profile/delete', {
    cookie,
    headers: { 'Idempotency-Key': `${key}-confirm` },
    body: { confirmToken },
  });
}

/** 로그인한 쿠키로 JSON을 PUT한다(시즌·은퇴 업로드 등). */
export const putJson = (ctx: TestD1, cookie: string, path: string, body: unknown) =>
  callJson(ctx.env, 'PUT', path, { cookie, body });

/** 시즌·은퇴 업로드 본문의 career 머리(테스트 공용). */
export const TEST_CAREER = {
  pos: 'FW',
  foot: '오른발',
  type: 'poacher',
  trait: 'late',
  startYear: 2026,
  appVersion: '1.0.0',
};

/** Set-Cookie에서 쿠키 하나의 값(빈 값일 수 있다). 없으면 던진다. */
export function extractCookie(setCookie: string, name: string): string {
  const match = new RegExp(`${name}=([^;]*)`).exec(setCookie);
  if (!match) throw new Error(`Set-Cookie에 ${name}이 없습니다.`);
  return match[1] ?? '';
}

export function extractSessionToken(setCookie: string): string {
  const token = extractCookie(setCookie, SESSION_COOKIE_NAME);
  if (!token) throw new Error(`Set-Cookie의 ${SESSION_COOKIE_NAME}이 비어 있습니다.`);
  return token;
}

/** 새 익명 프로필을 만들고 그 세션을 돌려준다(첫 `GET /v1/profile`이 프로필과 세션 쿠키를 발급한다). */
export async function issueCookie(
  ctx: TestD1,
): Promise<{ token: string; profileId: string; cookie: string }> {
  const res = await createApp().request('/v1/profile', {}, ctx.env);
  const token = extractSessionToken(res.headers.get('Set-Cookie') ?? '');
  const body = successEnvelope(ProfileSchema).parse(await res.json());
  return { token, profileId: body.data.id, cookie: `${SESSION_COOKIE_NAME}=${token}` };
}

/** 관리자 테스트의 이메일 — env.ADMIN_EMAILS에 이 값을 넣는다. */
export const ADMIN_EMAIL = 'admin@example.com';

/** 구글로 연결한 새 프로필. */
export async function issueGoogleCookie(ctx: TestD1, opts: Parameters<typeof linkGoogle>[2] = {}) {
  const who = await issueCookie(ctx);
  await linkGoogle(ctx, who.profileId, opts);
  return who;
}

/** ADMIN_EMAIL로 구글 연결한 새 프로필(관리자). */
export const issueAdminCookie = (ctx: TestD1, opts: { nickname?: string } = {}) =>
  issueGoogleCookie(ctx, { email: ADMIN_EMAIL, ...opts });

/** 시즌 업로드 본문(테스트 공용). over로 season 칸을 덮어쓴다. */
export const seasonBody = (over: Record<string, unknown> = {}) => ({
  career: TEST_CAREER,
  season: {
    age: 18,
    club: '테스트 고교',
    league: '고교리그',
    apps: 20,
    goals: 15,
    assists: 4,
    rating: 7.4,
    rank: 1,
    ovr: 58,
    honors: [],
    ...over,
  },
  events: [],
});
/** 은퇴 업로드 본문(테스트 공용). 30세 넘어 은퇴 — 명예의 전당·홈 소식에 오른다. */
export const RETIREMENT = {
  retireAge: 34,
  peak: 88,
  legendScore: 420,
  apps: 300,
  goals: 120,
  assists: 60,
  trophies: 1,
  awards: 0,
  caps: 30,
  ballon: 0,
  lastClub: '테스트 FC',
  publicName: null,
};

type Summary = Pick<
  typeof RETIREMENT,
  'retireAge' | 'peak' | 'apps' | 'goals' | 'assists' | 'trophies' | 'awards' | 'caps' | 'ballon'
>;
/** total을 n칸에 고르게 나눈 i번째 칸. */
const share = (total: number, n: number, i: number) =>
  Math.floor(total / n) + (i < total % n ? 1 : 0);

/**
 * 은퇴 요약을 뒷받침하는 시즌 기록(18세부터 은퇴 전 해까지, 연도 = 2008 + 나이). 서버는 은퇴 요약을 받아 둔 시즌
 * 기록으로 맞추므로(plausibility.ts) 은퇴를 보내기 전에 올린다. 우승·수상은 시즌 영예로, 최고 OVR은 마지막 시즌에.
 */
export function seasonsFor(summary: Summary = RETIREMENT) {
  const n = Math.max(1, summary.retireAge - 18);
  const honors = [
    ...Array.from({ length: summary.trophies }, (_, k) => `테스트 우승 ${k + 1}`),
    ...Array.from({ length: summary.ballon }, () => '발롱도르'),
    ...Array.from({ length: summary.awards - summary.ballon }, (_, k) => `테스트 상 ${k + 1}`),
  ];
  // 발롱도르는 한 시즌에 하나라 해마다 앞에서부터 하나씩 나눠 준다.
  const perSeason: string[][] = Array.from({ length: n }, () => []);
  honors.forEach((h, k) => perSeason[k % n]!.push(h));
  return Array.from({ length: n }, (_, i) => {
    const age = summary.retireAge - n + i;
    return {
      year: 2008 + age,
      body: seasonBody({
        age,
        apps: share(summary.apps, n, i),
        goals: share(summary.goals, n, i),
        assists: share(summary.assists, n, i),
        caps: share(summary.caps, n, i),
        ovr: i === n - 1 ? summary.peak : Math.min(summary.peak, 60),
        honors: perSeason[i],
      }),
    };
  });
}

/** seasonsFor의 시즌을 차례로 올린다. */
export async function putSeasonsFor(
  env: TestD1['env'],
  cookie: string,
  careerId: string,
  summary: Summary = RETIREMENT,
) {
  for (const s of seasonsFor(summary)) {
    const res = await callJson(env, 'PUT', `/v1/careers/${careerId}/seasons/${s.year}`, {
      cookie,
      body: s.body,
    });
    if (res.status !== 200) throw new Error(`시즌 업로드 실패 ${res.status}`);
  }
}
