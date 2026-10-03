import { AppError } from '../errors.js';

/** 1차는 관리자 자신의 기기 한 대로만 발송한다. 응답·토큰·인증값을 로그에 남기지 않는다. */
export async function sendPushTest(
  token: string,
  accessToken?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImpl('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        to: token,
        title: '오프사이드 알림 테스트',
        body: '공지와 릴리즈 노트 알림이 연결됐어요.',
        channelId: 'news',
        sound: 'default',
        data: { type: 'offside-news', board: 'notice', test: true },
      }),
    });
  } catch {
    throw new AppError({
      code: 'SERVICE_UNAVAILABLE',
      message: '알림 요청 결과를 확인하지 못했어요. 기기에서 수신 여부를 확인해 주세요.',
    });
  }
  if (!response.ok)
    throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: '알림 요청을 보내지 못했어요.' });
  let result: { data?: { status?: string; details?: { error?: string } } };
  try {
    result = (await response.json()) ?? {};
  } catch {
    throw new AppError({
      code: 'SERVICE_UNAVAILABLE',
      message: '알림 요청 결과를 확인하지 못했어요.',
    });
  }
  if (result.data?.status !== 'ok')
    throw new AppError({
      code: 'SERVICE_UNAVAILABLE',
      message: '알림 연결을 확인해 주세요.',
      details: {
        reason:
          result.data?.details?.error === 'DeviceNotRegistered'
            ? 'PUSH_DEVICE_NOT_REGISTERED'
            : 'PUSH_SEND_FAILED',
      },
    });
}
