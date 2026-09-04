import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-06-settled.golden.json';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import { verifySnapshot } from './simulate.js';

// T-2-005 D-39: contracts golden 순회·api cross-runtime 해시 테스트가 다른 fixture와 체이닝하지 않고
// 단독으로 재생할 수 있는, SETTLE_SEASON까지 간 독립 골든이다(seasonHistory[0].result 포함).
describe('career-06-settled fixture 결정론(유스 첫 시즌 FAST 결산)', () => {
  it('golden 값과 정확히 일치한다(revision·stateHash·rngStateDraws·age·seasonHistory)', () => {
    const { snapshot } = runSettledFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory).toEqual(golden.seasonHistory);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('SETTLE_SEASON 직전 시즌 통계·평균 평점·대회 기록이 golden과 같다', () => {
    const { beforeSettlement } = runSettledFixture();
    expect(beforeSettlement).toEqual(golden.beforeSettlement);
  });

  it('seasonHistory[0].result가 결산 결과(성장 delta·baseOvr·stateDeltas)를 담는다', () => {
    const { snapshot } = runSettledFixture();
    const result = snapshot.state.seasonHistory[0]?.result;
    expect(result).toBeDefined();
    expect(result?.attributeDeltas.length).toBeGreaterThan(0);
    expect(result?.hash).toBe(golden.seasonHistory[0]?.result.hash);
  });

  it('같은 fixture를 100회 실행해도 매번 golden hash와 같다', { timeout: 15000 }, () => {
    for (let i = 0; i < 100; i++) {
      const { snapshot } = runSettledFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
    }
  });

  // T-3-001: PR #45 후속 — 결산 뒤 season이 null이 되며 사라지던 다이어리 step 요약을 stepSummaries로
  // 보존한다. 브리프 인수 조건은 "길이 12"라고 적지만, step 12(SETTLEMENT)는 walkToNextDecision
  // 루프(`while (currentStepIndex < 12)`)가 다루지 않고 SETTLE_SEASON이 곧장 닫아 markStepPassed를
  // 타지 않는다 — summary가 항상 null이라 실제로는 11이다(PR 본문 "결정 필요" 참고, 브리프는 고치지
  // 않는다). season.steps[].summary가 null이 아닌 step만 옮겼는지를 실제 값으로 고정한다.
  it('SeasonResult.stepSummaries가 season.steps[].summary와 같은 값을 담는다(step 12 SETTLEMENT는 제외)', () => {
    const { snapshot, stepSummaries } = runSettledFixture();
    const result = snapshot.state.seasonHistory[0]?.result;
    expect(result).toBeDefined();
    const nonNullSteps = stepSummaries.filter((step) => step.summary !== null);
    expect(nonNullSteps).toHaveLength(11);
    expect(stepSummaries.find((step) => step.index === 12)?.summary).toBeNull();
    expect(result?.stepSummaries).toEqual(
      nonNullSteps.map((step) => ({
        step: step.index,
        phase: step.phase,
        matchesPlayed: step.summary!.matchesPlayed,
        decisionsOpened: step.summary!.decisionsOpened,
        passedAtRevision: step.summary!.passedAtRevision,
      })),
    );
  });
});
