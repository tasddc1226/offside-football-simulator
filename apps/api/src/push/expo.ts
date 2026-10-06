import { AppError } from '../errors.js';
import type { Lang } from '../lang.js';
import { pushText } from './text.js';

/** 현재 앱 세션 소유자의 기기 한 대로만 발송한다. 응답·토큰·인증값을 로그에 남기지 않는다. */
export async function sendPushTest(
  token: string,
  accessToken?: string,
  fetchImpl: typeof fetch = fetch,
  notificationId?: string,
  lang: Lang = 'ko',
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      // workerd는 'error'를 지원하지 않는다. 3xx를 따라가지 않고 아래 HTTP 검사에서 거절한다.
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        to: token,
        title: pushText('오프사이드 알림 테스트', lang),
        body: pushText('공지와 릴리즈 노트 알림이 연결됐어요.', lang),
        channelId: 'news',
        sound: 'default',
        data: {
          type: 'offside-news',
          board: 'notice',
          test: true,
          ...(notificationId ? { notificationId } : {}),
        },
      }),
    });
  } catch {
    throw new AppError({
      code: 'SERVICE_UNAVAILABLE',
      message: '알림 요청 결과를 확인하지 못했어요. 기기에서 수신 여부를 확인해 주세요.',
    });
  }
  if (!response.ok)
    throw new AppError({
      code: 'SERVICE_UNAVAILABLE',
      message: '알림 요청을 보내지 못했어요.',
      ...(response.status < 500 && response.status !== 408
        ? { details: { reason: 'PUSH_SEND_FAILED' } }
        : {}),
    });
  let result: { data?: { status?: string; id?: string; details?: { error?: string } } };
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
      ...(result.data?.status === 'error'
        ? {
            details: {
              reason:
                result.data?.details?.error === 'DeviceNotRegistered'
                  ? 'PUSH_DEVICE_NOT_REGISTERED'
                  : 'PUSH_SEND_FAILED',
            },
          }
        : {}),
    });
  if (typeof result.data.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(result.data.id))
    throw new AppError({
      code: 'SERVICE_UNAVAILABLE',
      message: '알림 접수 번호를 확인하지 못했어요.',
    });
  return result.data.id;
}
