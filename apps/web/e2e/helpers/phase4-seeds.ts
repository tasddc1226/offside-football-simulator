// T-4-009 §3: presentation(INJURY·SLUMP·LOCKER_ROOM·ETHICS·MEDIA·NATIONAL_TEAM·RUMOUR)별 결정론
// 도달 seed. `find-seed.ts --max-seasons 2 --seed-count 2000`(기본값, PR 본문 §3 도달성 표와 동일)을
// pack 0.2.0(seed-prefix `offside-seed-search`)과 0.3.0(seed-prefix `offside-seed-search-v3`,
// T-4-008이 이 작업 도중 main에 머지돼 함께 탐색했다) 양쪽에 돌려 찾았고, 각 값은
// `apps/web/src/engine/phase4-seed-reachability.test.ts`가 `career-actions.ts`(실제 화면이 쓰는
// 명령 조립)로 독립 재생해 같은 pending이 열리는지 확인했다.
//
// T-4-005가 이 상수를 그대로 쓴다: e2e에서 `localStorage['offside:e2e-seed'] = seed`·
// `localStorage['offside:e2e-content-pack'] = packVersion`을 실행 전에 설정하면(예:
// `chapter.ts`의 `seedDeterministicChapterRun`과 같은 관례) 해당 season·step에서 정확히 그
// eventId가 pending으로 열린다 — "첫 선택지 반복"으로 온보딩·시즌을 진행했을 때 기준이다(다른
// 선택 경로를 쓰면 다른 step에 열릴 수 있다).
export type Phase4Presentation = 'INJURY' | 'SLUMP' | 'LOCKER_ROOM' | 'ETHICS' | 'MEDIA' | 'NATIONAL_TEAM' | 'RUMOUR';

export type Phase4SeedHit = {
  packVersion: string;
  seed: string;
  seasonIndex: number;
  step: number;
  eventId: string;
};

/** 두 팩 모두 2,000개 seed 전부를 스윕했다(seedsScanned=2000, lastBlockedReasons 없음 — 모든 seed가
 * 시즌 예산 안에서 정상적으로 시즌을 종료했다). 0.2.0에서는 NATIONAL_TEAM·RUMOUR가 안 열렸지만,
 * 0.3.0에서는 NATIONAL_TEAM이 열려(seed -v3-1422) 그 값을 여기 썼다 — 나머지 5종은 0.2.0 탐색
 * 결과를 그대로 쓴다(두 팩 다 같은 presentation·eventId 구조). RUMOUR는 두 팩(4,000 seed-시도) 모두
 * 값이 없다(PR 본문 "미도달" 표 참고) — T-4-005는 그 항목에 e2e 대신 단위 렌더 테스트만 두면 된다
 * (브리프 0절).
 *
 * NATIONAL_TEAM(0.2.0) 미도달 사유: `packages/domain/src/national-team.ts` 콜업 자격이 `step===8`
 * + (티어별 최소 OVR) 또는 (직전 시즌 평균 평점≥7.0 그리고 인기≥6000/10000)을 요구한다 — 시즌 2
 * 예산 안에서는 "직전 시즌"이 시즌 1 하나뿐이라 우연히 그 문턱을 넘는 seed가 0.2.0 2,000개 중에는
 * 없었지만 0.3.0 2,000개 중에는 하나(-v3-1422) 있었다(같은 ruleset이므로 순전히 난수 확률 차이).
 * RUMOUR 미도달 사유: `EVT-CON-010`이 `season.step===7`(이적 시장) + 정규 계약 + 마지막 시즌 아님 +
 * (출전≥15 또는 평점≥6.5)을 요구한다 — 두 팩 합쳐 4,000개 중에 조건을 만족한 seed가 없었다. 둘 다
 * `packages/content`·`packages/domain` 게이팅 로직을 그대로 재현한 결과이지 탐색 도구의 결함이
 * 아니다(가짜 pending·강제 이벤트로 도달성을 만들지 않는다 — T-4-005 브리프 0절). */
export const PHASE4_SEEDS: Partial<Record<Phase4Presentation, Phase4SeedHit>> = {
  INJURY: { packVersion: '0.2.0', seed: 'offside-seed-search-2', seasonIndex: 1, step: 6, eventId: 'EVT-INJ-001' },
  SLUMP: { packVersion: '0.2.0', seed: 'offside-seed-search-6', seasonIndex: 1, step: 9, eventId: 'EVT-SLUMP-010' },
  LOCKER_ROOM: { packVersion: '0.2.0', seed: 'offside-seed-search-1', seasonIndex: 2, step: 9, eventId: 'EVT-REL-010' },
  ETHICS: { packVersion: '0.2.0', seed: 'offside-seed-search-0', seasonIndex: 2, step: 9, eventId: 'EVT-ETH-010' },
  MEDIA: { packVersion: '0.2.0', seed: 'offside-seed-search-0', seasonIndex: 1, step: 4, eventId: 'EVT-MEDIA-010' },
  NATIONAL_TEAM: { packVersion: '0.3.0', seed: 'offside-seed-search-v3-1422', seasonIndex: 2, step: 8, eventId: 'EVT-NAT-001' },
};
