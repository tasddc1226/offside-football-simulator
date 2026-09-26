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
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(opts.cookie ? { Cookie: opts.cookie } : {}), ...opts.headers },
      ...(method === 'GET' ? {} : { body: JSON.stringify(opts.body ?? {}) }),
    },
    env,
  );
}

/** 로그인한 쿠키로 JSON을 PUT한다(시즌·은퇴 업로드 등). */
export const putJson = (ctx: TestD1, cookie: string, path: string, body: unknown) => callJson(ctx.env, 'PUT', path, { cookie, body });

/** 시즌·은퇴 업로드 본문의 career 머리(테스트 공용). */
export const TEST_CAREER = { pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late', startYear: 2026, appVersion: '1.0.0' };

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
export const issueAdminCookie = (ctx: TestD1, opts: { nickname?: string } = {}) => issueGoogleCookie(ctx, { email: ADMIN_EMAIL, ...opts });
