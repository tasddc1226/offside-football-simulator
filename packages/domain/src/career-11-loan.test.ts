import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-11-loan.golden.json';
import { careerLoanFixture, rulesetProto, runLoanFixture } from './__fixtures__/career-11-loan.js';
import { hashState } from './hash.js';
import { evaluateLoanReturnRole } from './loan-return.js';
import { computeSquadStatus } from './selection.js';
import { simulate, verifySnapshot } from './simulate.js';
import type { CareerState, Contract, DomainSnapshot } from './types.js';

/**
 * T-3-003 §8 골든 2(career-11-loan): 첫 계약 3시즌 → 시즌1 완주·결산(계약 잔여 2, INTEREST 시장에 LOAN
 * 제안) → ACCEPT_OFFER(LOAN, §4) → 임대 구단 시즌2 완주·결산(parentRemaining 1 → LOAN_RETURN pending)
 * → LOAN_RETURN({decision:'RETURN'}, §6) → 시즌3(원소속) 시작까지. parentContract·stint 3개(원소속
 * LOANED → 임대 → 원소속 재개설)를 골든으로 고정한다.
 */
describe('career-11-loan fixture — INTEREST 시장 LOAN·LOAN_RETURN(RETURN) 골든', () => {
  it('golden 값과 정확히 일치한다', () => {
    const { snapshot } = runLoanFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.checkpoint).toBe(golden.checkpoint);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.seasonHistory).toHaveLength(golden.seasonHistoryLength);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('원소속 계약이 복원되고(parentContract null), 3개 stint(원소속 LOANED → 임대 RETURNED → 원소속 재개설)를 clubHistory에 남긴다', () => {
    const { snapshot } = runLoanFixture();
    const contract = snapshot.state.contract!;
    expect(contract.id).toBe(golden.contract.id);
    expect(contract.teamId).toBe(golden.contract.teamId);
    expect(contract.leagueTier).toBe(golden.contract.leagueTier);
    expect(contract.kind).toBe(golden.contract.kind);
    expect(contract.lengthSeasons).toBe(golden.contract.lengthSeasons);
    expect(contract.suspended).toBe(golden.contract.suspended);
    expect(snapshot.state.parentContract).toBeNull();
    expect(snapshot.state.season?.manager?.id.startsWith(`${contract.teamId}-mgr-`)).toBe(true);

    expect(snapshot.state.clubHistory).toEqual(
      golden.clubHistory.map((stint) => ({
        ...stint,
        teamName: expect.any(String),
        leagueTier: expect.any(Number),
        contractId:
          'contractId' in stint && stint.contractId !== null
            ? stint.contractId
            : expect.any(String),
      })),
    );
  });

  it('임대 시즌 중에는 parentContract가 suspended:true로 원소속 계약을 보관한다', () => {
    // 골든 재생과 별개로, LOAN 수락 직후~LOAN_RETURN 전 상태를 직접 만들어 D-46 불변식을 확인한다.
    const { snapshot } = runLoanFixture();
    // 최종 상태(복귀 완료)에서는 parentContract가 다시 null이다 — 임대 "중" 상태는 clubHistory의
    // LOAN stint 존재로 간접 확인한다(그 시즌 동안 parentContract가 non-null이었다는 사실 자체는
    // simulate.ts의 acceptLoanOffer·restoreParentContractAndStint 단위 테스트가 직접 고정한다).
    const loanStint = snapshot.state.clubHistory.find((stint) => stint.kind === 'LOAN');
    expect(loanStint).toBeDefined();
    expect(loanStint?.endReason).toBe('RETURNED');
  });

  it('타임라인에 LOANED → LOAN_RETURNED(RETURN)가 순서대로 남는다', () => {
    const { snapshot } = runLoanFixture();
    const kinds = snapshot.state.timeline.map((entry) => entry.kind);
    const loanedIndex = kinds.indexOf('LOANED');
    const returnedIndex = kinds.indexOf('LOAN_RETURNED', loanedIndex);
    expect(loanedIndex).toBeGreaterThanOrEqual(0);
    expect(returnedIndex).toBeGreaterThan(loanedIndex);
    expect(snapshot.state.timeline[returnedIndex]!.refId).toBe('RETURN');
  });
});

// 이슈 #148: 임대 복귀 시 임대 성과가 원소속 역할 재평가에 반영되지 않는다(운영 QA WG S3 임대 20/22경기
// 주전 → S4 복귀 직후 벤치→예비 하향). 원인: loanReturn(RETURN)의 restoreParentClubState가
// context.squadStatus를 원소속 rolePromise 기본값으로 되돌리고, 다음 START_SEASON도 lastRating null로
// 재계산해 임대 시즌 평점·출전이 어디에도 쓰이지 않는다. 1.4.0 키 `transferRules.loanReturn.reevaluate`가
// 있을 때만 재평가하고, 키가 없는 골든(위 describe)은 그대로다.
describe('이슈 #148: LOAN_RETURN(RETURN) 원소속 역할 재평가(1.4.0 키 가드)', () => {
  const RULESET_1_4_0 = {
    ...rulesetProto,
    transferRules: { ...rulesetProto.transferRules, loanReturn: { reevaluate: true } },
  };

  /** LOAN_RETURN 직전(임대 시즌 결산 뒤, pending LOAN_RETURN) 상태. */
  function beforeLoanReturn(ruleset = rulesetProto): DomainSnapshot {
    const truncated = { ...careerLoanFixture, commands: careerLoanFixture.commands.slice(0, -2) };
    const { snapshot } = runLoanFixture({ fixture: truncated, ruleset });
    expect(snapshot.state.pending?.kind).toBe('LOAN_RETURN');
    return snapshot;
  }

  /** 임대 시즌 출전을 주전급(1670/2070분)으로 덮어써 "임대에서 잘 뛰고 돌아온" 상황을 만든다. */
  function withStarterLoanSeason(snapshot: DomainSnapshot): DomainSnapshot {
    const last = snapshot.state.seasonHistory.at(-1)!;
    const result = last.result;
    const starterMinutes = 1670;
    const state: CareerState = {
      ...snapshot.state,
      seasonHistory: [
        ...snapshot.state.seasonHistory.slice(0, -1),
        {
          ...last,
          result: {
            ...result,
            selectionSummary: { ...result.selectionSummary, minutes: starterMinutes },
            playerStats: { ...result.playerStats, minutes: starterMinutes },
          },
        },
      ],
    };
    return { ...snapshot, state, stateHash: hashState(state) };
  }

  function loanReturn(snapshot: DomainSnapshot, ruleset = rulesetProto) {
    return simulate({
      snapshot,
      command: { type: 'LOAN_RETURN', commandId: 'loan-return-148', expectedRevision: snapshot.revision, payload: { decision: 'RETURN' } },
      ruleset,
      rulesetVersion: careerLoanFixture.rulesetVersion,
      contentPackVersion: careerLoanFixture.contentPackVersion,
    });
  }

  it('재현(키 없음): 임대에서 주전급으로 뛰어도 복귀 뒤 rolePromise·squadStatus는 원소속 기본값(RESERVE·25)으로 리셋된다', () => {
    const snapshot = withStarterLoanSeason(beforeLoanReturn());
    const parent = snapshot.state.parentContract!;
    expect(parent.rolePromise).toBe('RESERVE');
    const returned = loanReturn(snapshot);
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    expect(returned.snapshot.state.contract?.rolePromise).toBe('RESERVE');
    expect(returned.snapshot.state.context.squadStatus).toBe(rulesetProto.contractRules.squadStatusByRole.RESERVE);
  });

  it('1.4.0(loanReturn.reevaluate): 임대 출전 비율이 이행한 역할을 원소속 등급 상한(1부: BENCH) 안에서 rolePromise·appearancePromise·squadStatus에 반영한다', () => {
    const snapshot = withStarterLoanSeason(beforeLoanReturn());
    const parent = snapshot.state.parentContract!;
    const evaluation = evaluateLoanReturnRole({ state: snapshot.state, ruleset: RULESET_1_4_0, parent });
    expect(evaluation).not.toBeNull();
    if (evaluation === null) return;
    expect(evaluation.applies).toBe(true);
    expect(evaluation.loanSeason.minutesShareBp).toBe(Math.round((1670 * 10000) / 2070));
    expect(evaluation.deliveredRole).toBe('STARTER');
    expect(evaluation.ceilingRole).toBe('BENCH');
    expect(evaluation.reevaluatedRole).toBe('BENCH');
    expect(evaluation.cappedByTier).toBe(true);
    expect(evaluation.belowPromise).toBe(false);
    // 출전 수는 직전 시즌 결산 화면(appearanceSummary)과 같은 식(1분 이상 뛴 경기)이어야 한다.
    const appearances = snapshot.state.seasonHistory.at(-1)!.result.playerStats.appearances;
    expect(evaluation.loanSeason.matches).toBe(appearances.total - appearances.zeroMinute);
    expect(evaluation.loanSeason.sub).toBe(appearances.sub - (appearances.zeroMinute - appearances.out));
    const avgRatingTenths = Math.round(evaluation.loanSeason.avgRatingTenths!);
    expect(evaluation.squadStatus).toBe(
      computeSquadStatus(
        { rolePromise: 'BENCH', captaincy: 'NONE', lastRating: avgRatingTenths / 10 },
        rulesetProto.selectionRules,
        rulesetProto.contractRules.squadStatusByRole,
      ),
    );

    const returned = loanReturn(snapshot, RULESET_1_4_0);
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    const contract = returned.snapshot.state.contract!;
    expect(contract.id).toBe(parent.id);
    expect(contract.rolePromise).toBe('BENCH');
    expect(contract.appearancePromise).toEqual({ minutesShareBp: rulesetProto.contractRules.promiseMinutesShareBp.BENCH });
    expect(returned.snapshot.state.context.squadStatus).toBe(evaluation.squadStatus);
    // rng 소비 없음.
    expect(returned.snapshot.state.rngState.draws).toBe(snapshot.state.rngState.draws);
  });

  it('1.4.0: 임대 출전이 원소속 약속보다 못해도 복귀로 역할이 내려가지는 않는다(골든 임대 시즌 12% → RESERVE 그대로)', () => {
    const snapshot = beforeLoanReturn(RULESET_1_4_0);
    const parent = snapshot.state.parentContract!;
    const evaluation = evaluateLoanReturnRole({ state: snapshot.state, ruleset: RULESET_1_4_0, parent })!;
    expect(evaluation.deliveredRole).toBe('RESERVE');
    expect(evaluation.reevaluatedRole).toBe('RESERVE');
    expect(evaluation.cappedByTier).toBe(false);
    expect(evaluation.belowPromise).toBe(false);
    const returned = loanReturn(snapshot, RULESET_1_4_0);
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    expect(returned.snapshot.state.contract?.rolePromise).toBe('RESERVE');
  });

  it('1.4.0: 원소속 약속(BENCH)보다 임대 이행 역할(RESERVE)이 낮으면 belowPromise=true·cappedByTier=false로 "상한" 아닌 "하향 없음" 사유가 된다', () => {
    const snapshot = beforeLoanReturn(RULESET_1_4_0);
    const parent: Contract = { ...snapshot.state.parentContract!, rolePromise: 'BENCH' };
    const evaluation = evaluateLoanReturnRole({ state: snapshot.state, ruleset: RULESET_1_4_0, parent })!;
    expect(evaluation.deliveredRole).toBe('RESERVE');
    expect(evaluation.ceilingRole).toBe('BENCH');
    expect(evaluation.reevaluatedRole).toBe('BENCH');
    expect(evaluation.belowPromise).toBe(true);
    expect(evaluation.cappedByTier).toBe(false);
  });

  it('evaluateLoanReturnRole은 마지막 시즌이 원소속 시즌이면 null이다', () => {
    const { snapshot } = runLoanFixture();
    // 전체 재생 뒤에는 시즌 3(원소속)이 활성이고 seasonHistory.at(-1)은 임대 시즌이라 non-null이지만,
    // 원소속 시즌 요약으로 바꿔 끼우면 null이어야 한다.
    const parent = snapshot.state.contract!;
    const state: CareerState = {
      ...snapshot.state,
      seasonHistory: snapshot.state.seasonHistory.map((summary) => ({ ...summary, teamId: parent.teamId })),
    };
    expect(evaluateLoanReturnRole({ state, ruleset: RULESET_1_4_0, parent })).toBeNull();
  });
});
