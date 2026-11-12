import { apiFetch, apiBaseUrl, type ApiResult, type Profile } from './transport.js';

export function unlinkGoogle(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/google/unlink', { method: 'POST' });
}
export function logout(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/logout', { method: 'POST' });
}
export function startProfileDeletion(): Promise<
  ApiResult<{ confirmToken: string; expiresAt: string }>
> {
  return apiFetch('/v1/profile/delete', { method: 'POST' });
}
/** appleAuthorizationCode: T-11-167 Apple로 로그인한 앱이 삭제 직전에 다시 받은 코드(서버가 Apple 토큰을 해지한다). */
export function confirmProfileDeletion(
  confirmToken: string,
  appleAuthorizationCode?: string,
): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/profile/delete', {
    method: 'POST',
    body: JSON.stringify({
      confirmToken,
      appleAuthorizationCode,
    }),
  });
}
/** T-10-028 댓글에 쓰는 닉네임. 구글 로그인한 프로필만 정할 수 있다(겹치면 409 NICKNAME_TAKEN). */
export function putNickname(nickname: string): Promise<ApiResult<Profile>> {
  return apiFetch('/v1/profile/nickname', { method: 'PUT', body: JSON.stringify({ nickname }) });
}
export function putAvatar(image: string | null): Promise<ApiResult<Profile>> {
  return apiFetch('/v1/profile/avatar', { method: 'PUT', body: JSON.stringify({ image }) });
}
export const ownerAvatarUrl = (id: string): string =>
  `${apiBaseUrl()}/v1/avatars/${encodeURIComponent(id)}`;
export function googleStartUrl(): string {
  return `${apiBaseUrl()}/v1/auth/google/start`;
}
/** T-11-204 웹 Sign in with Apple 시작 주소(주소창으로 연다). */
export function appleStartUrl(): string {
  return `${apiBaseUrl()}/v1/auth/apple/start`;
}
