// 새 커리어는 서버의 현재 서비스 시즌이 지정한 룰셋·팩을 한 레코드에서 함께 고정한다.
// 아래 ACTIVE 상수는 네트워크와 로컬 캐시가 모두 없을 때의 안전한 kickoff 폴백과 진단용 기본값이다.
// 운영 승격 목표 manifest(tooling/scripts/production-release.mjs PRODUCTION_SEASON)와 같은 값을 유지한다.
import { PACK_VERSIONS, RULESET_VERSIONS } from '@offside/content';
import type { ServiceSeasonCurrent } from '@offside/contracts';

export const ACTIVE_RULESET_VERSION = '1.5.0';
export const ACTIVE_CONTENT_PACK_VERSION = '0.6.0';

/**
 * T-2-012 D-54: 더 이상 "활성 시즌"이 아니다 — 서버가 `ACTIVE_SERVICE_SEASON_ID`(env var)로 가리키는
 * 현재 서비스 시즌을 `engine/service-season.ts`가 조회한다. 이 값은 그 조회가 실패(오프라인·API
 * 오류)하고 kv-store 캐시도 없을 때만 쓰는 최후 폴백이다. id·이름·기간은 apps/api/seeds/local.sql의
 * svc_kickoff와 같고, 룰셋·팩만 운영 승격 목표 manifest를 따른다(1.5.0 승격, 2026-09-13).
 */
export const FALLBACK_SERVICE_SEASON_ID = 'svc_kickoff';
export const FALLBACK_SERVICE_SEASON: ServiceSeasonCurrent = {
  id: FALLBACK_SERVICE_SEASON_ID,
  name: 'Kickoff',
  status: 'ACTIVE',
  isTest: false,
  startsAt: '2026-09-01T00:00:00Z',
  endsAt: '2026-12-31T23:59:59Z',
  rulesetVersion: ACTIVE_RULESET_VERSION,
  contentPackVersion: ACTIVE_CONTENT_PACK_VERSION,
  notice: null,
};

/**
 * T-4-009 D-56: DEV 화면·해시 진단 전용 콘텐츠 팩 오버라이드. 새 커리어 CREATE의 버전은 이 값이
 * 아니라 current service-season fixture/응답이 결정한다. `import.meta.env.DEV`는 프로덕션 빌드에서 상수
 * false로 치환돼 이 분기가 죽은 코드로 제거된다(같은 관례: `career-actions.ts`의 `offside:e2e-seed`
 * 훅, `apps/web/src/main.tsx`의 `/__dev/hash-probe` 분기) — 프로덕션 번들·경로는 바뀌지 않는다.
 * `localStorage['offside:e2e-content-pack']`이 `PACK_VERSIONS`에 있는 값이면 그 값을, 아니면(없거나
 * 잘못된 값) `ACTIVE_CONTENT_PACK_VERSION`을 돌려준다. `engine.ts`(엔진 팩 로딩)와 `content.ts`(화면이
 * 읽는 싱글턴)가 이 함수 하나만 써야 두 값이 어긋나지 않는다(PR 본문 "팩 선택 지점" 표 참고).
 */
export const E2E_CONTENT_PACK_STORAGE_KEY = 'offside:e2e-content-pack';
export const E2E_RULESET_STORAGE_KEY = 'offside:e2e-ruleset';

/** 신규 규칙 검증은 명시적 QA에서만 허용한다. 저장된 커리어의 버전은 바꾸지 않는다. */
export function resolveActiveRulesetVersion(): string {
  const dev = import.meta.env.DEV && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage.getItem(E2E_RULESET_STORAGE_KEY) : undefined;
  return dev && (RULESET_VERSIONS as readonly string[]).includes(dev)
    ? dev : ACTIVE_RULESET_VERSION;
}

export function selectContentPackVersion(input: {
  dev: boolean;
  devOverride: string | null;
}): string {
  if (
    input.dev &&
    input.devOverride !== null &&
    (PACK_VERSIONS as readonly string[]).includes(input.devOverride)
  ) {
    return input.devOverride;
  }
  return ACTIVE_CONTENT_PACK_VERSION;
}

export function resolveActiveContentPackVersion(): string {
  const devOverride =
    import.meta.env.DEV &&
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function'
      ? localStorage.getItem(E2E_CONTENT_PACK_STORAGE_KEY)
      : null;
  return selectContentPackVersion({
    dev: import.meta.env.DEV,
    devOverride,
  });
}
