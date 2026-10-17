import { z } from 'zod';

/**
 * T-11-331 앱·웹 오류 모으기(POST /v1/client-errors). 화면에서 난 오류를 묶음으로 보낸다. 서버는 isolate 메모리에
 * 같은 오류끼리 세어 두었다가 1분에 한 번 `client_errors`(KST 날짜 × 지문)에 더한다(apps/api/src/status/clientErrors.ts).
 * 세션 · 프로필 · 선수 이름은 보내지 않는다.
 */
export const CLIENT_ERROR_PLATFORMS = ['web', 'ios', 'android'] as const;
/** error: 잡히지 않은 오류, rejection: 처리 안 된 Promise 거절, fatal: 앱이 멈춘 오류(다음 실행에 보낸다), render: 화면 그리기 오류. */
export const CLIENT_ERROR_KINDS = ['error', 'rejection', 'fatal', 'render'] as const;
export const CLIENT_ERROR_MAX_ITEMS = 10;

export const ClientErrorItemSchema = z.strictObject({
  kind: z.enum(CLIENT_ERROR_KINDS),
  message: z.string().max(500),
  stack: z.string().max(4000).optional(),
  /** 화면 · 경로(예: `play`, `/team`). */
  where: z.string().max(120).optional(),
});

export const ClientErrorReportSchema = z.strictObject({
  platform: z.enum(CLIENT_ERROR_PLATFORMS),
  /** 앱은 `1.1.3 (18) · OTA 앞 8자`, 웹은 빌드 버전. */
  version: z.string().max(60),
  items: z.array(ClientErrorItemSchema).min(1).max(CLIENT_ERROR_MAX_ITEMS),
});

export type ClientErrorItem = z.infer<typeof ClientErrorItemSchema>;
export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>;
