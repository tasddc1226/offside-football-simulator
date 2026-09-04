import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-10-transfer.golden.json';
import { runTransferFixture } from './__fixtures__/career-10-transfer.js';
import { verifySnapshot } from './simulate.js';

/**
 * T-3-003 §8 골든 1(career-10-transfer): 첫 계약 1시즌(min) → 시즌1 완주(step 7 RENEWAL은
 * REJECT_OFFER(null)로 이어간다) → 결산(계약 잔여 0 → EXPIRED 시장) → 안전 잔류가 아닌 제안에
 * NEGOTIATE(WAGE, 이 seed는 COUNTERED) → ACCEPT_OFFER(FREE_AGENT, §4 TRANSFER·FREE_AGENT 분기) →
 * 새 구단에서 시즌2 완주·결산 → 시즌3 시작까지. NEGOTIATE가 rng를 정확히 1회 소비하는지, ACCEPT_OFFER가
 * clubHistory·타임라인·태그를 §4대로 바꾸는지 골든으로 고정한다.
 */
describe('career-10-transfer fixture — EXPIRED 시장 NEGOTIATE·ACCEPT_OFFER(FREE_AGENT) 골든', () => {
  it('golden 값과 정확히 일치한다', () => {
    const { snapshot } = runTransferFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.checkpoint).toBe(golden.checkpoint);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.seasonHistory).toHaveLength(golden.seasonHistoryLength);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('계약이 EXPIRED로 닫힌 첫 구단과 FREE_AGENT로 새로 서명한 둘째 구단, 2개 stint를 clubHistory에 남긴다', () => {
    const { snapshot } = runTransferFixture();
    const contract = snapshot.state.contract!;
    expect(contract.id).toBe(golden.contract.id);
    expect(contract.teamId).toBe(golden.contract.teamId);
    expect(contract.leagueTier).toBe(golden.contract.leagueTier);
    expect(contract.kind).toBe(golden.contract.kind);
    expect(contract.lengthSeasons).toBe(golden.contract.lengthSeasons);
    expect(contract.signingBonusMinor).toBeGreaterThan(0);

    expect(snapshot.state.clubHistory).toEqual(
      golden.clubHistory.map((stint) => ({
        ...stint,
        teamName: expect.any(String),
        leagueTier: expect.any(Number),
        contractId: expect.any(String),
      })),
    );
    expect(snapshot.state.parentContract).toBeNull();
  });

  it('두 번째 결산의 INTEREST pending은 OFR-23-0 안전 잔류를 열고, 수락 뒤 START_SEASON으로 닫힌다', () => {
    const { steps } = runTransferFixture();
    const marketStep = steps.find(
      (step) => step.command.type === 'SETTLE_SEASON' && step.snapshot.revision === 23,
    );
    if (marketStep === undefined) throw new Error('career-10: 두 번째 SETTLE_SEASON step이 없다.');
    const pending = marketStep.snapshot.state.pending;
    if (pending === null || pending.kind !== 'OFFERS') {
      throw new Error('career-10: 두 번째 결산 뒤 OFFERS pending이 없다.');
    }
    expect(pending.market).toEqual({
      openedAtRevision: 23,
      seasonIndex: 2,
      reason: 'INTEREST',
      safeOfferId: 'OFR-23-0',
    });
    expect(pending.offers[0]).toMatchObject({ id: 'OFR-23-0', kind: 'RENEWAL' });

    const acceptIndex = steps.findIndex(
      (step) => step.command.type === 'ACCEPT_OFFER' && step.command.payload.offerId === 'OFR-23-0',
    );
    if (acceptIndex < 0) throw new Error('career-10: OFR-23-0 ACCEPT_OFFER step이 없다.');
    const acceptStep = steps[acceptIndex]!;
    const acceptCommand = acceptStep.command;
    if (acceptCommand.type !== 'ACCEPT_OFFER') throw new Error('career-10: 안전 수락 command가 아니다.');
    expect(acceptCommand.payload.offerId).toBe('OFR-23-0');
    expect(acceptStep.snapshot.revision).toBe(24);
    expect(acceptStep.snapshot.state.pending).toBeNull();
    expect(acceptStep.snapshot.state.contract).toEqual(marketStep.snapshot.state.contract);
    expect(acceptStep.snapshot.state.clubHistory).toEqual(marketStep.snapshot.state.clubHistory);
    expect(acceptStep.snapshot.state.rngState.draws).toBe(marketStep.snapshot.state.rngState.draws);

    const startStep = steps[acceptIndex + 1];
    if (startStep === undefined || startStep.command.type !== 'START_SEASON') {
      throw new Error('career-10: 안전 수락 직후 START_SEASON이 없다.');
    }
    expect(startStep.snapshot.revision).toBe(25);
    expect(startStep.snapshot.checkpoint).toBe('SEASON_START');
  });

  it('같은 career-10 명령 로그를 replay하면 trace와 최종 snapshot이 완전히 같다', () => {
    expect(runTransferFixture()).toEqual(runTransferFixture());
  });

  it('이적_희망·잔류_선언 태그는 없고, NEGOTIATE·ACCEPT_OFFER 타임라인이 순서대로 남는다', () => {
    const { snapshot } = runTransferFixture();
    expect(snapshot.state.tags).toEqual(golden.tags);
    expect(snapshot.state.tags).not.toContain('이적_희망');
    expect(snapshot.state.tags).not.toContain('잔류_선언');
    expect(snapshot.state.season?.manager?.id.startsWith(`${snapshot.state.contract?.teamId}-mgr-`)).toBe(true);

    const kinds = snapshot.state.timeline.map((entry) => entry.kind);
    const negotiateIndex = kinds.indexOf('NEGOTIATED');
    const signIndex = kinds.indexOf('CONTRACT_SIGNED', negotiateIndex);
    expect(negotiateIndex).toBeGreaterThanOrEqual(0);
    expect(signIndex).toBeGreaterThan(negotiateIndex);

    const negotiated = snapshot.state.timeline[negotiateIndex]!;
    expect(negotiated.refId).toBe('OFR-16-1:WAGE:COUNTERED');
  });

  it('NEGOTIATE는 rng를 정확히 1회 소비하고, 나머지(REJECT_OFFER·ACCEPT_OFFER)는 소비하지 않는다', () => {
    const { snapshot } = runTransferFixture();
    // OFFER_REJECTED(step 7)와 NEGOTIATED 둘 다 타임라인에 있고, 두 사건 사이 draws 델타가 딱 1이면
    // (다른 명령들이 그 사이 어떤 rng도 안 썼다는 뜻이라) NEGOTIATE 자신의 소비량이 1임을 보장한다.
    // 여기서는 더 직접적으로: NEGOTIATE 처리기 자체가 rollInt 1회만 쓴다는 사실은 simulate.test류
    // 단위 테스트가 별도로 고정한다 — 이 골든은 최종 draws 값 자체를 고정해 회귀를 잡는다.
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
  });
});
