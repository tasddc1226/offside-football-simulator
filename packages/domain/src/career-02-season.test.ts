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

      // T-2-003 D-35: SETTLE_SEASON 직전 경기 수·시즌 통계·대회 기록이 golden과 같다(matches 전체
      // 배열은 golden에 남기지 않는다 — 용량. FAST·CHAPTER byte-identical은 아래 별도 테스트로 검증).
      it('SETTLE_SEASON 직전 경기 수·선수 시즌 통계·평균 평점·대회 기록이 golden과 같다', () => {
        const { beforeSettlement } = runSeasonFixture(mode);
        expect({
          matchesPlayed: beforeSettlement.matchesPlayed,
          playerStats: beforeSettlement.playerStats,
          averageRatingTenths: beforeSettlement.averageRatingTenths,
          competitions: beforeSettlement.competitions,
        }).toEqual(golden[mode].beforeSettlement);
      });

      // 시간 예산 검사는 hash 일치 검사와 별도 테스트로 나눈다(fixture-determinism.test.ts의
      // 1,000회 테스트와 같은 이유: 워크스페이스 전체 병렬 실행 시 부하로 5초 기본 타임아웃을
      // 넘길 수 있다). T-2-002가 START_SEASON에 경쟁자 생성·전술 적합도 계산을 더해 반복당
      // 비용이 늘어 CHAPTER 모드에서 실제로 초과가 관측됐다(2026-09-03).
      // 브리프 필수 테스트 벡터: "같은 seed 1,000회 반복 실행의 시즌 hash가 전부 같다". CHAPTER는
      // FAST보다 결정이 많아(위 stepSummaries 테스트) 반복당 비용이 더 크다(단독 실행 약 35ms/회,
      // 1,000회 약 35초) — 워크스페이스 전체 병렬 실행 부하를 감안해 타임아웃을 넉넉히 둔다.
      it('같은 fixture를 1,000회 실행해도 매번 golden hash와 같다', { timeout: 90000 }, () => {
        for (let i = 0; i < 1000; i++) {
          const { snapshot } = runSeasonFixture(mode);
          expect(snapshot.stateHash).toBe(golden[mode].stateHash);
        }
      });
    });
  }

  // T-2-004 D-38: 이 fixture는 chapterCandidates를 보내지 않으므로(챕터 시스템은 별도
  // career-05-chapter fixture가 다룬다) step 3·6·10·11(CHAPTER)은 두 모드 모두 후보가 없어 열리지
  // 않는다 — 실제로 열리는 결정은 ROLE(1)·CONTRACT(7)뿐이다.
  it('FAST 모드: 예산(6)을 넘지 않아 아무것도 잘리지 않고, 실제 열리는 결정은 step 1·7(ROLE·CONTRACT)뿐이다', () => {
    const opened = golden.FAST.stepSummaries.filter((s) => s.summary !== null && s.summary.decisionsOpened === 1);
    expect(opened.map((s) => s.index)).toEqual([1, 7]);
  });

  it('CHAPTER 모드: 예산 상한(10)에 정확히 맞아 잘리는 슬롯이 없고, ROLE·EVENT·CONTRACT(챕터 제외 step 1~11) 전부 결정이 열린다', () => {
    const opened = golden.CHAPTER.stepSummaries.filter((s) => s.summary !== null && s.summary.decisionsOpened === 1);
    expect(opened.map((s) => s.index)).toEqual([1, 2, 4, 5, 7, 8, 9]);
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

  // T-2-003 D-35 브리프 필수 테스트 벡터: 경기는 결정 슬롯과 분리된 전용 RNG 스트림(season.matchRngState)을
  // 쓰므로, FAST·CHAPTER가 결정에서 소비하는 RNG 양이 달라도(위 테스트) matches는 byte-identical해야 한다.
  it('FAST와 CHAPTER의 matches는 같은 seed에서 byte-identical하다', () => {
    const fast = runSeasonFixture('FAST').beforeSettlement;
    const chapter = runSeasonFixture('CHAPTER').beforeSettlement;
    expect(fast.matches.length).toBeGreaterThan(0);
    expect(fast.matches).toEqual(chapter.matches);
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
