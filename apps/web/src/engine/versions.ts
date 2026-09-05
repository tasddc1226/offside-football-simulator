// 커리어별 룰셋·팩 버전 선택은 Phase 6(서버가 현재 서비스 시즌을 알려줄 때) 항목이다. Phase 1은
// 앱 전체가 이 상수 하나만 쓴다.
import { PACK_VERSIONS } from '@offside/content';

export const ACTIVE_RULESET_VERSION = '1.0.0';
export const ACTIVE_CONTENT_PACK_VERSION = '0.1.0';

/**
 * T-2-012 D-54: 더 이상 "활성 시즌"이 아니다 — 서버가 `ACTIVE_SERVICE_SEASON_ID`(env var)로 가리키는
 * 현재 서비스 시즌을 `engine/service-season.ts`가 조회한다. 이 값은 그 조회가 실패(오프라인·API
 * 오류)하고 kv-store 캐시도 없을 때만 쓰는 최후 폴백이다. apps/api/seeds/local.sql의 svc_kickoff와 같다.
 */
export const FALLBACK_SERVICE_SEASON_ID = 'svc_kickoff';

/**
 * T-4-009 D-56: DEV 서버 전용 콘텐츠 팩 오버라이드. `import.meta.env.DEV`는 프로덕션 빌드에서 상수
 * false로 치환돼 이 분기가 죽은 코드로 제거된다(같은 관례: `career-actions.ts`의 `offside:e2e-seed`
 * 훅, `apps/web/src/main.tsx`의 `/__dev/hash-probe` 분기) — 프로덕션 번들·경로는 바뀌지 않는다.
 * `localStorage['offside:e2e-content-pack']`이 `PACK_VERSIONS`에 있는 값이면 그 값을, 아니면(없거나
 * 잘못된 값) `ACTIVE_CONTENT_PACK_VERSION`을 돌려준다. `engine.ts`(엔진 팩 로딩)와 `content.ts`(화면이
 * 읽는 싱글턴)가 이 함수 하나만 써야 두 값이 어긋나지 않는다(PR 본문 "팩 선택 지점" 표 참고).
 */
export const E2E_CONTENT_PACK_STORAGE_KEY = 'offside:e2e-content-pack';

export function resolveActiveContentPackVersion(): string {
  if (import.meta.env.DEV && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    const override = localStorage.getItem(E2E_CONTENT_PACK_STORAGE_KEY);
    if (override !== null && (PACK_VERSIONS as readonly string[]).includes(override)) {
      return override;
    }
  }
  return ACTIVE_CONTENT_PACK_VERSION;
}
