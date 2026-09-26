/**
 * T-10-047. 홈 라이브 현황(GET /v1/live) 폴링 간격. zod가 없는 서브패스(`@offside/contracts/polling`)라 웹이 값으로
 * 가져와도 번들에 zod가 들어가지 않는다 — 서버 엣지 캐시 TTL, 웹 폴링 간격, 웹 메모 캐시가 이 한 값에서 나온다.
 * CLAUDE.md 백엔드 보호: 폴링은 분 단위.
 */
export const LIVE_POLL_SEC = 60;
