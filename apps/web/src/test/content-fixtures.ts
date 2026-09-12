// 웹 단위 테스트가 엔진 오프라인 폴백 상수(engine/versions.ts의 ACTIVE_RULESET_VERSION·
// ACTIVE_CONTENT_PACK_VERSION)와 무관하게 고정된 콘텐츠·버전으로 돌아가게 하는 테스트 전용
// 픽스처다. 저 상수는 운영 승격 목표를 따르므로 계속 바뀌지만(#198: 1.0.0/0.1.0 →
// 1.4.0/0.5.1), 여기 값은 이 파일을 의도적으로 올릴 때만 바뀐다 — 테스트가 특정 팩·룰셋
// 버전의 콘텐츠(이벤트·챕터·서사 토큰 등)를 기대할 때는 `engine/content.js`의 전역 싱글턴
// (activeContentPack/activeRuleset) 대신 이 모듈을 쓴다.
import { loadContentPack, loadRuleset } from '@offside/content';
import type { ServiceSeasonCurrent } from '@offside/contracts';
import { serviceSeasonQueryOptions } from '../engine/service-season.js';
import { queryClient } from '../shared/query-client.js';

export const TEST_RULESET_VERSION = '1.0.0';
export const TEST_CONTENT_PACK_VERSION = '0.1.0';

export const testRuleset = loadRuleset(TEST_RULESET_VERSION);
export const testContentPack = loadContentPack(TEST_CONTENT_PACK_VERSION);

/**
 * `resolveServiceSeason()`(engine/service-season.js)이 react-query 캐시 히트 경로에서
 * 돌려주는 값. career-actions.ts의 createCareer는 이 레코드의 rulesetVersion·
 * contentPackVersion을 그대로 새 커리어에 고정하므로, 테스트가 만드는 커리어도 이 값으로
 * 고정된다(테스트 엔진에 직접 주입한 ruleset/pack과 무관하게 결정되는 값이라 따로 시딩이
 * 필요하다).
 */
export const TEST_SERVICE_SEASON: ServiceSeasonCurrent = {
  id: 'svc_test',
  name: 'Test Season',
  status: 'ACTIVE',
  isTest: true,
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: null,
  rulesetVersion: TEST_RULESET_VERSION,
  contentPackVersion: TEST_CONTENT_PACK_VERSION,
  notice: null,
};

/**
 * `queryClient.clear()` 뒤(예: 각 테스트의 setTestEngine 안)에 호출한다 — clear가 먼저
 * 실행돼야 이 시딩이 지워지지 않는다. resolveServiceSeason()의 첫 시도(react-query
 * fetchQuery)가 네트워크 호출 없이 이 값을 캐시 히트로 돌려주게 만든다.
 */
export function seedTestServiceSeason(): void {
  queryClient.setQueryData(serviceSeasonQueryOptions.queryKey, TEST_SERVICE_SEASON);
}
