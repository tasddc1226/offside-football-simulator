// T-4-009 §3: 현재 재현 가능한 presentation별 결정론
// 도달 seed. 기존 PR의 2,000-seed 탐색 기록과 현재 코드의 제한 탐색 결과를 구분한다.
// 현재 값은 pack 0.2.0의 maxSeasons=2, seedCount=30/100 및 pack 0.3.0의
// seedCount=3/maxSeasons=15 제한 탐색에서 갱신했고, 각 값은
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

/** 현재 제한 탐색에서 재현된 값만 기록한다. RUMOUR는 빈 CONTRACT 체크포인트에서
 * ADVANCE하는 실제 경로로 재현되었다. NATIONAL_TEAM은 제한된 0~2 seed/15시즌 탐색
 * 결과를 확인한 뒤 도달한 경우에만 추가한다. 시드가 바뀌면 이 표와
 * `phase4-seed-reachability.test.ts`를 함께 갱신해야 한다. */
export const PHASE4_SEEDS: Partial<Record<Phase4Presentation, Phase4SeedHit>> = {
  INJURY: { packVersion: '0.2.0', seed: 'offside-seed-search-2', seasonIndex: 1, step: 6, eventId: 'EVT-INJ-001' },
  SLUMP: { packVersion: '0.2.0', seed: 'offside-seed-search-17', seasonIndex: 1, step: 5, eventId: 'EVT-SLUMP-010' },
  LOCKER_ROOM: { packVersion: '0.2.0', seed: 'offside-seed-search-70', seasonIndex: 1, step: 8, eventId: 'EVT-REL-010' },
  ETHICS: { packVersion: '0.2.0', seed: 'offside-seed-search-2', seasonIndex: 2, step: 9, eventId: 'EVT-ETH-010' },
  MEDIA: { packVersion: '0.2.0', seed: 'offside-seed-search-0', seasonIndex: 1, step: 4, eventId: 'EVT-MEDIA-010' },
  RUMOUR: { packVersion: '0.2.0', seed: 'offside-seed-search-0', seasonIndex: 2, step: 7, eventId: 'EVT-CON-010' },
};
