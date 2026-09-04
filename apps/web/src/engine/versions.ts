// 커리어별 룰셋·팩 버전 선택은 Phase 6(서버가 현재 서비스 시즌을 알려줄 때) 항목이다. Phase 1은
// 앱 전체가 이 상수 하나만 쓴다.
export const ACTIVE_RULESET_VERSION = '1.0.0';
export const ACTIVE_CONTENT_PACK_VERSION = '0.1.0';

/**
 * T-2-012 D-54: 더 이상 "활성 시즌"이 아니다 — 서버가 `ACTIVE_SERVICE_SEASON_ID`(env var)로 가리키는
 * 현재 서비스 시즌을 `engine/service-season.ts`가 조회한다. 이 값은 그 조회가 실패(오프라인·API
 * 오류)하고 kv-store 캐시도 없을 때만 쓰는 최후 폴백이다. apps/api/seeds/local.sql의 svc_kickoff와 같다.
 */
export const FALLBACK_SERVICE_SEASON_ID = 'svc_kickoff';
