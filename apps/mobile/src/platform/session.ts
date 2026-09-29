// T-11-005 앱 세션. 웹은 세션 쿠키를 쓰지만 앱은 서버가 발급한 세션 토큰을 기기 보안 저장소(Keychain·Keystore)에
// 두고 요청마다 Authorization: Bearer로 보낸다(T-11-003). 토큰은 시작 때 한 번 메모리로 읽는다 — apiFetch의 auth()가
// 동기라서다. 토큰이 없으면 인증 없는 요청이 나가고, 계정이 필요한 요청은 서버가 PROFILE_REQUIRED로 거절한다.
import * as SecureStore from 'expo-secure-store';

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
