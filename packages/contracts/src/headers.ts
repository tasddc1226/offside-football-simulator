export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IF_MATCH_HEADER = 'If-Match';
export const AUTHORIZATION_HEADER = 'Authorization';
export const REQUEST_ID_HEADER = 'X-Request-Id';
export const CONTENT_TYPE_HEADER = 'Content-Type';

/** 07 "공통 규칙": Access-Control-Allow-Headers에 포함해야 하는 커스텀 헤더. */
export const CORS_ALLOWED_HEADERS = [
  AUTHORIZATION_HEADER,
  IF_MATCH_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  CONTENT_TYPE_HEADER,
  REQUEST_ID_HEADER,
] as const;

/** Access-Control-Expose-Headers. 클라이언트가 응답에서 읽어야 하는 커스텀 헤더. */
export const CORS_EXPOSED_HEADERS = [REQUEST_ID_HEADER] as const;

/** 07 "공통 규칙": 요청 본문 상한 1MB. */
export const REQUEST_BODY_MAX_BYTES = 1_048_576;
