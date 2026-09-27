/**
 * T-10-047. 홈 라이브 현황(GET /v1/live) 폴링 간격. zod가 없는 서브패스(`@offside/contracts/polling`)라 웹이 값으로
 * 가져와도 번들에 zod가 들어가지 않는다 — 서버 엣지 캐시 TTL, 웹 폴링 간격, 웹 메모 캐시가 이 한 값에서 나온다.
 * CLAUDE.md 백엔드 보호: 폴링은 분 단위.
 */
export const LIVE_POLL_SEC = 60;
/** 홈 라이브 피드 줄 수 상한(서버 조회와 웹의 실시간 병합이 같이 쓴다). */
export const LIVE_FEED_MAX = 12;

/** T-10-072 홈 라이브 실시간 소켓(WebSocket). 새 시즌·은퇴 소식을 올라오는 즉시 밀어 준다 — 폴링은 숫자를 맞추고
 * 소켓이 끊겼을 때를 받친다. */
export const LIVE_SOCKET_PATH = '/v1/live/ws';
/** 연결 유지용 핑 간격. 서버(Durable Object)는 깨지 않고 자동으로 pong을 돌려준다. */
export const LIVE_PING_SEC = 45;
export const LIVE_PING = 'ping';
export const LIVE_PONG = 'pong';
