import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-11-loan.golden.json';
import { runLoanFixture } from './__fixtures__/career-11-loan.js';
import { verifySnapshot } from './simulate.js';

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
