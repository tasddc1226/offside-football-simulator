// T-11-005 앱 세션. 웹은 세션 쿠키를 쓰지만 앱은 서버가 발급한 세션 토큰을 기기 보안 저장소(Keychain·Keystore)에
// 두고 요청마다 Authorization: Bearer로 보낸다(T-11-003). 토큰은 시작 때 한 번 메모리로 읽는다 — apiFetch의 auth()가
// 동기라서다. 토큰이 없으면 ensureSession()이 POST /v1/app/session으로 익명 앱 세션을 받는다.
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '@offside/app-core/api/client';

const KEY = 'offside_session';
let token: string | null = null;

export async function loadSession(): Promise<void> {
  try {
    token = await SecureStore.getItemAsync(KEY);
  } catch {
    token = null;
  }
}

export const sessionToken = () => token;

export async function setSessionToken(next: string | null): Promise<void> {
  token = next;
  try {
    if (next) await SecureStore.setItemAsync(KEY, next);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // 보안 저장소를 못 쓰면 이번 실행 동안만 쓴다.
  }
}

export const authHeaders = (): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

let pending: Promise<boolean> | null = null;
/** 토큰이 없으면 새 익명 앱 세션을 받는다(첫 실행·로그아웃·탈퇴 뒤). 동시에 불러도 한 번만 받는다. */
export function ensureSession(): Promise<boolean> {
  if (token) return Promise.resolve(true);
  pending ??= apiFetch<{ token: string }>('/v1/app/session', { method: 'POST' })
    .then(async (r) => {
      if (r.ok) await setSessionToken(r.data.token);
      return r.ok;
    })
    .finally(() => (pending = null));
  return pending;
}
