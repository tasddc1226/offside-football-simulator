import { ProfileSchema, successEnvelope } from '@offside/contracts';
import { createApp } from '../app.js';
import type { TestD1 } from './d1.js';

// T-10-044: 라우트 테스트 공용 HTTP 헬퍼(12개 파일에 복사돼 있던 것을 모았다).

export function extractSessionToken(setCookie: string): string {
  const token = /offside_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) throw new Error('Set-Cookie에 offside_session이 없습니다.');
  return token;
}

/** 새 익명 프로필을 만들고 그 세션을 돌려준다(첫 `GET /v1/profile`이 프로필과 세션 쿠키를 발급한다). */
export async function issueCookie(
  ctx: TestD1,
): Promise<{ token: string; profileId: string; cookie: string }> {
  const res = await createApp().request('/v1/profile', {}, ctx.env);
  const token = extractSessionToken(res.headers.get('Set-Cookie') ?? '');
  const body = successEnvelope(ProfileSchema).parse(await res.json());
  return { token, profileId: body.data.id, cookie: `offside_session=${token}` };
}
