import type { Bindings } from '../env.js';

/** iOS·Android 공용 Expo 전송 경계. 토큰·본문을 로그에 남기지 않고 리다이렉트도 따라가지 않는다. */
export async function postExpo(
  env: Pick<Bindings, 'EXPO_PUSH_ACCESS_TOKEN'>,
  path: 'send' | 'getReceipts',
  body: unknown,
  transport: typeof fetch = fetch,
) {
  return transport(`https://exp.host/--/api/v2/push/${path}`, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/json',
      ...(env.EXPO_PUSH_ACCESS_TOKEN
        ? { Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
}
