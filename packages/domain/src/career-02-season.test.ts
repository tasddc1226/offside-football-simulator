import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-02-season.golden.json';
import { runSeasonFixture } from './__fixtures__/career-02-season.js';
import { verifySnapshot } from './simulate.js';
import type { SimulationMode } from './types.js';

const MODES = ['FAST', 'CHAPTER'] as const satisfies readonly SimulationMode[];

describe('career-02-season fixture 결정론', () => {
  for (const mode of MODES) {
    describe(`${mode} 모드`, () => {
      it('golden 값과 정확히 일치한다(revision·stateHash·rngStateDraws·age·seasonHistory·checkpoints·stepSummaries)', () => {
        const expected = golden[mode];
        const { snapshot, checkpoints, stepSummaries } = runSeasonFixture(mode);

        expect(snapshot.revision).toBe(expected.revision);
        expect(snapshot.stateHash).toBe(expected.stateHash);
        expect(snapshot.state.rngState.draws).toBe(expected.rngStateDraws);
        expect(snapshot.state.age).toBe(expected.age);
        expect(snapshot.state.season).toBeNull();
        expect(snapshot.state.seasonHistory).toEqual(expected.seasonHistory);
        expect(checkpoints).toEqual(expected.checkpoints);
        expect(stepSummaries).toEqual(expected.stepSummaries);
        expect(verifySnapshot(snapshot)).toEqual({ ok: true });
      });

      // 브리프 golden 절차 3: START_SEASON 다음 RESOLVE_ROLE 직후(경쟁자 생성 직후) 스쿼드 상태.
      it('RESOLVE_ROLE 직후 경쟁자 수·선수 selection·전술 적합도·스쿼드 상태가 golden과 같다', () => {
        const { afterRoleResolve } = runSeasonFixture(mode);
        expect(afterRoleResolve).toEqual(golden[mode].afterRoleResolve);
      });

      // 시간 예산 검사는 hash 일치 검사와 별도 테스트로 나눈다(fixture-determinism.test.ts의
      // 1,000회 테스트와 같은 이유: 워크스페이스 전체 병렬 실행 시 부하로 5초 기본 타임아웃을
      // 넘길 수 있다). T-2-002가 START_SEASON에 경쟁자 생성·전술 적합도 계산을 더해 반복당
      // 비용이 늘어 CHAPTER 모드에서 실제로 초과가 관측됐다(2026-09-03).
      it('같은 fixture를 100회 실행해도 매번 golden hash와 같다', { timeout: 15000 }, () => {
        for (let i = 0; i < 100; i++) {
          const { snapshot } = runSeasonFixture(mode);
          expect(snapshot.stateHash).toBe(golden[mode].stateHash);
        }
      });
    });
  }

  it('FAST 모드: 예산(6)을 넘지 않아 아무것도 잘리지 않고, 실제 열리는 결정은 step 1·3·7·11(ROLE·CHAPTER·CONTRACT·CHAPTER)뿐이다', () => {
    const opened = golden.FAST.stepSummaries.filter((s) => s.summary !== null && s.summary.decisionsOpened === 1);
    expect(opened.map((s) => s.index)).toEqual([1, 3, 7, 11]);
  });

  it('CHAPTER 모드: 예산 상한(10)에 정확히 맞아 잘리는 슬롯이 없고, step 1~11 전부 결정이 열린다', () => {
    const opened = golden.CHAPTER.stepSummaries.filter((s) => s.summary !== null && s.summary.decisionsOpened === 1);
    expect(opened.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('FAST가 여는 결정 step 집합은 CHAPTER가 여는 결정 step 집합의 부분집합이다', () => {
    const fastOpened = new Set(
      golden.FAST.stepSummaries.filter((s) => s.summary?.decisionsOpened === 1).map((s) => s.index),
    );
    const chapterOpened = new Set(
      golden.CHAPTER.stepSummaries.filter((s) => s.summary?.decisionsOpened === 1).map((s) => s.index),
    );
    for (const step of fastOpened) {
      expect(chapterOpened.has(step)).toBe(true);
    }
  });

  it('시즌 진행 동안 rng 소비량: CHAPTER가 FAST보다 EVENT 해소 5회만큼(step 2·4·5·8·9) 더 쓴다', () => {
    expect(golden.FAST.rngStateDraws).toBeLessThanOrEqual(golden.CHAPTER.rngStateDraws);
    expect(golden.CHAPTER.rngStateDraws - golden.FAST.rngStateDraws).toBe(5);
  });

  it('FAST와 CHAPTER는 같은 seed에서 출발해도 결정 수가 달라 최종 stateHash가 다르다', () => {
    const fast = runSeasonFixture('FAST').snapshot;
    const chapter = runSeasonFixture('CHAPTER').snapshot;
    expect(fast.stateHash).not.toBe(chapter.stateHash);
  });

  // RESOLVE_EVENT로 EVENT pending이 해소된 뒤(자동 통과가 아니다) 다음 ADVANCE가 그 step을
  // decisionsOpened: 1로 정확히 닫는지 golden으로 고정한다(season.test.ts의 단위 테스트와 같은
  // 회귀를 fixture 결정론 레벨에서도 지킨다).
  it('CHAPTER 모드: EVENT로 열린 step(2·4·5·8·9)도 decisionsOpened: 1로 기록된다', () => {
    const eventSteps = [2, 4, 5, 8, 9];
    for (const index of eventSteps) {
      const summary = golden.CHAPTER.stepSummaries.find((s) => s.index === index)?.summary;
      expect(summary?.decisionsOpened).toBe(1);
    }
  });
});
