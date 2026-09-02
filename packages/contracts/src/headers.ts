export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IF_MATCH_HEADER = 'If-Match';
export const AUTHORIZATION_HEADER = 'Authorization';
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** 07 "공통 규칙": Access-Control-Allow-Headers에 포함해야 하는 커스텀 헤더. */
export const CORS_ALLOWED_HEADERS = [AUTHORIZATION_HEADER, IF_MATCH_HEADER, IDEMPOTENCY_KEY_HEADER] as const;

/** 07 "공통 규칙": 요청 본문 상한 1MB. */
export const REQUEST_BODY_MAX_BYTES = 1_048_576;

/** 07 "공통 규칙": Snapshot은 압축 전 256KB 권장 상한. */
export const SNAPSHOT_STATE_RECOMMENDED_BYTES = 262_144;
