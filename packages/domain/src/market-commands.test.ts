import { describe, expect, it } from 'vitest';
import { careerLoanFixture } from './__fixtures__/career-11-loan.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import { hashState } from './hash.js';
import { rollInt, seedRng } from './rng.js';
import { computeTacticalFit, findTacticalStyle } from './selection.js';
import { simulate, type Command, type SimulationResult } from './simulate.js';
import type { CareerState, DomainSnapshot, Offer } from './types.js';

type EngineCommand = Command & { commandId: string; expectedRevision: number };

function runCommand(
  snapshot: DomainSnapshot,
  command: EngineCommand,
  ruleset = rulesetProto,
): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) throw new Error(`${command.type} failed: ${result.error.code}`);
  return result.snapshot;
}

function rehashSnapshot(snapshot: DomainSnapshot, state: CareerState): DomainSnapshot {
  return { ...snapshot, state, stateHash: hashState(state) };
}

function withOffers(
  snapshot: DomainSnapshot,
  offers: Offer[],
  reason: 'EXPIRED' | 'INTEREST' = 'EXPIRED',
  safeOfferId: string | null = offers[0]?.id ?? null,
): DomainSnapshot {
  const state: CareerState = {
    ...snapshot.state,
    pending: {
      kind: 'OFFERS',
      offers,
      market: {
        openedAtRevision: snapshot.revision,
        seasonIndex: snapshot.state.seasonHistory.length,
        reason,
        safeOfferId,
      },
    },
  };
  return rehashSnapshot(snapshot, state);
}

function withPendingLoanReturn(
  snapshot: DomainSnapshot,
  options: Array<'RETURN' | 'PERMANENT'>,
): DomainSnapshot {
  return rehashSnapshot(snapshot, {
    ...snapshot.state,
    pending: { kind: 'LOAN_RETURN', options, buyOptionMinor: 120_000_000 },
  });
}

function makeOffer(
  state: CareerState,
  overrides: Pick<Offer, 'id' | 'kind' | 'teamId'> & Partial<Omit<Offer, 'id' | 'kind' | 'teamId'>>,
): Offer {
  const contract = state.contract;
  const profile = state.player.profile;
  if (contract === null || profile === null)
    throw new Error('offer fixture requires contract and profile');
  const { id, kind, teamId, ...rest } = overrides;
  const team = rulesetProto.teams.find((candidate) => candidate.id === teamId);
  return {
    id,
    kind,
    teamId,
    teamName: team?.name ?? contract.teamName,
    fromTeamId: kind === 'RENEWAL' ? contract.teamId : null,
    leagueTier: team?.leagueTier ?? contract.leagueTier,
    lengthSeasons: kind === 'LOAN' ? 1 : 2,
    wageMinorPerWeek: 1_000_000,
    signingBonusMinor: 2_000_000,
    transferFeeMinor: kind === 'TRANSFER' ? 50_000_000 : null,
    rolePromise: 'ROTATION',
    appearancePromise: {
      minutesShareBp: rulesetProto.contractRules.promiseMinutesShareBp.ROTATION,
    },
    positionPlan: profile.primaryPosition,
    shirtNumber: 17,
    tacticalFitEstimate: 73,
    competitorSummary: null,
    validUntilRevision: null,
    negotiable:
      kind === 'LOAN'
        ? { wage: false, role: true, length: false }
        : { wage: true, role: true, length: true },
    negotiationState: 'OPEN',
    negotiatedAsk: null,
    loan:
      kind === 'LOAN'
        ? { parentTeamId: contract.teamId, seasons: 1, wageShareBp: 5000, buyOptionMinor: null }
        : null,
    ...rest,
  };
}

function otherTeamId(state: CareerState): string {
  const currentTeamId = state.contract?.teamId;
  const team = rulesetProto.teams.find(
    (candidate) => candidate.id !== currentTeamId && candidate.leagueTier !== 'YOUTH',
  );
  if (team === undefined) throw new Error('offer fixture requires another professional team');
  return team.id;
}

function acceptCommand(snapshot: DomainSnapshot, offerId: string): EngineCommand {
  return {
    type: 'ACCEPT_OFFER',
    commandId: `accept-${snapshot.revision}-${offerId}`,
    expectedRevision: snapshot.revision,
    payload: { offerId },
  };
}

function negotiateCommand(
  snapshot: DomainSnapshot,
  offerId: string,
  ask: 'WAGE' | 'ROLE' | 'LENGTH',
): EngineCommand {
  return {
    type: 'NEGOTIATE',
    commandId: `negotiate-${snapshot.revision}-${offerId}`,
    expectedRevision: snapshot.revision,
    payload: { offerId, ask },
  };
}

function loanReturnCommand(
  snapshot: DomainSnapshot,
  decision: 'RETURN' | 'PERMANENT',
): EngineCommand {
  return {
    type: 'LOAN_RETURN',
    commandId: `loan-return-${snapshot.revision}-${decision}`,
    expectedRevision: snapshot.revision,
    payload: { decision },
  };
}

function runLoanPrefix(commandCount: number): DomainSnapshot {
  const created = simulate({
    snapshot: null,
    command: {
      type: 'CREATE_CAREER',
      commandId: 'loan-test-create',
      expectedRevision: 0,
      payload: {
        careerId: careerLoanFixture.createCareer.careerId,
        seed: careerLoanFixture.createCareer.seed,
        simulationMode: careerLoanFixture.createCareer.simulationMode,
        rulesetVersion: careerLoanFixture.rulesetVersion,
        contentPackVersion: careerLoanFixture.contentPackVersion,
      },
    },
    ruleset: rulesetProto,
    rulesetVersion: careerLoanFixture.rulesetVersion,
    contentPackVersion: careerLoanFixture.contentPackVersion,
  });
  if (!created.ok) throw new Error(`CREATE_CAREER failed: ${created.error.code}`);

  let snapshot = created.snapshot;
  for (let index = 0; index < commandCount; index++) {
    const raw = careerLoanFixture.commands[index];
    if (raw === undefined) throw new Error(`loan fixture command ${index} is missing`);
    snapshot = runCommand(snapshot, {
      ...(raw as Command),
      commandId: `loan-test-${index + 1}`,
      expectedRevision: snapshot.revision,
    });
  }
  return snapshot;
}

function runLoanFixtureCommands(
  snapshot: DomainSnapshot,
  startIndex: number,
  endIndex: number,
  ruleset = rulesetProto,
): DomainSnapshot {
  let next = snapshot;
  for (let index = startIndex; index < endIndex; index++) {
    const raw = careerLoanFixture.commands[index];
    if (raw === undefined) throw new Error(`loan fixture command ${index} is missing`);
    next = runCommand(
      next,
      {
        ...(raw as Command),
        commandId: `loan-test-tail-${index + 1}`,
        expectedRevision: next.revision,
      },
      ruleset,
    );
  }
  return next;
}

describe('T-3-003 P1 market command regressions', () => {
  it('ACCEPT_OFFER는 선언 태그를 제거하기 전에 잔류_선언을 라이벌·배신 이적으로 판정한다', () => {
    const settled = runSettledFixture().snapshot;
    const sourceState: CareerState = {
      ...settled.state,
      tags: ['잔류_선언'],
      relationships: { ...settled.state.relationships, fans: 100 },
      contract: { ...settled.state.contract!, promiseBreaches: 0 },
    };
    const source = rehashSnapshot(settled, sourceState);
    const movingOffer = makeOffer(source.state, {
      id: 'OFR-declaration-transfer',
      kind: 'TRANSFER',
      teamId: otherTeamId(source.state),
    });
    const offered = withOffers(source, [movingOffer], 'EXPIRED', 'OFR-safe-not-selected');

    const result = simulate({
      snapshot: offered,
      command: acceptCommand(offered, movingOffer.id),
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.relationships.fans).toBe(
      Math.max(
        0,
        Math.floor((100 * rulesetProto.transferRules.relationshipCarry.fansCarryBp) / 10000) +
          rulesetProto.transferRules.relationshipCarry.rivalMoveFansDelta,
      ),
    );
    expect(result.snapshot.state.tags).toContain('배신_이적');
    expect(result.snapshot.state.tags).not.toContain('잔류_선언');
    expect(result.snapshot.state.clubHistory.at(-2)?.endReason).toBe('TRANSFERRED');
    expect(result.snapshot.state.timeline.at(-1)?.kind).toBe('TRANSFERRED');
  });

  it('LOAN 수락은 약속 위반 상태여도 두 이동 팬 델타·배신_이적을 적용하지 않고 fansCarryBp만 적용한다', () => {
    const settled = runSettledFixture().snapshot;
    const sourceState: CareerState = {
      ...settled.state,
      tags: ['잔류_선언', '약속_위반'],
      relationships: { ...settled.state.relationships, fans: 100 },
      contract: { ...settled.state.contract!, promiseBreaches: 1 },
    };
    const source = rehashSnapshot(settled, sourceState);
    const loanOffer = makeOffer(source.state, {
      id: 'OFR-promise-loan',
      kind: 'LOAN',
      teamId: otherTeamId(source.state),
    });
    const offered = withOffers(source, [loanOffer], 'INTEREST', 'OFR-safe-not-selected');
    const attributesBefore = { ...offered.state.attributes };
    const baseOvrBefore = offered.state.player.profile!.baseOvr;

    const result = simulate({
      snapshot: offered,
      command: acceptCommand(offered, loanOffer.id),
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.relationships.fans).toBe(
      Math.floor((100 * rulesetProto.transferRules.relationshipCarry.fansCarryBp) / 10000),
    );
    expect(result.snapshot.state.tags).not.toContain('배신_이적');
    expect(result.snapshot.state.tags).not.toContain('잔류_선언');
    expect(result.snapshot.state.parentContract).toEqual(
      expect.objectContaining({ promiseBreaches: 1, suspended: true }),
    );
    expect(result.snapshot.state.contract?.kind).toBe('LOAN');
    expect(result.snapshot.state.player.profile?.baseOvr).toBe(baseOvrBefore);
    expect(result.snapshot.state.attributes).toEqual(attributesBefore);
  });

  it.each([
    { kind: 'RENEWAL' as const, expectedTimeline: 'CONTRACT_RENEWED' as const },
    { kind: 'TRANSFER' as const, expectedTimeline: 'TRANSFERRED' as const },
    { kind: 'FREE_AGENT' as const, expectedTimeline: 'CONTRACT_SIGNED' as const },
    { kind: 'LOAN' as const, expectedTimeline: 'LOANED' as const },
  ])(
    'ACCEPT_OFFER $kind는 계약·stint·pending을 한 원자 전환으로 갱신한다',
    ({ kind, expectedTimeline }) => {
      const settled = runSettledFixture().snapshot;
      const state = {
        ...settled.state,
        captaincy: 'CAPTAIN' as const,
        captaincySeasons: 4,
      };
      const source = rehashSnapshot(settled, state);
      const teamId = kind === 'RENEWAL' ? state.contract!.teamId : otherTeamId(state);
      const offer = makeOffer(state, { id: `OFR-atomic-${kind}`, kind, teamId });
      const offered = withOffers(source, [offer], 'EXPIRED', offer.id);
      const attributesBefore = { ...offered.state.attributes };
      const baseOvrBefore = offered.state.player.profile!.baseOvr;

      const result = simulate({
        snapshot: offered,
        command: acceptCommand(offered, offer.id),
        ruleset: rulesetProto,
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.revision).toBe(offered.revision + 1);
      expect(result.snapshot.state.pending).toBeNull();
      expect(result.snapshot.state.timeline.at(-1)?.kind).toBe(expectedTimeline);
      expect(result.snapshot.state.player.profile?.baseOvr).toBe(baseOvrBefore);
      expect(result.snapshot.state.attributes).toEqual(attributesBefore);
      if (kind === 'RENEWAL') {
        expect(result.snapshot.state.contract?.teamId).toBe(state.contract?.teamId);
        expect(result.snapshot.state.clubHistory).toHaveLength(state.clubHistory.length);
        expect(result.snapshot.state.captaincy).toBe('CAPTAIN');
        expect(result.snapshot.state.captaincySeasons).toBe(4);
      } else if (kind === 'LOAN') {
        expect(result.snapshot.state.contract?.kind).toBe('LOAN');
        expect(result.snapshot.state.parentContract).toEqual(
          expect.objectContaining({ suspended: true }),
        );
        expect(result.snapshot.state.clubHistory).toHaveLength(state.clubHistory.length + 1);
        expect(result.snapshot.state.captaincy).toBe('NONE');
        expect(result.snapshot.state.captaincySeasons).toBe(0);
        expect(result.snapshot.state.nextManager).toBeNull();
      } else {
        expect(result.snapshot.state.contract?.kind).toBe('PERMANENT');
        expect(result.snapshot.state.contract?.teamId).toBe(teamId);
        expect(result.snapshot.state.parentContract).toBeNull();
        expect(result.snapshot.state.clubHistory).toHaveLength(state.clubHistory.length + 1);
        expect(result.snapshot.state.captaincy).toBe('NONE');
        expect(result.snapshot.state.captaincySeasons).toBe(0);
        expect(result.snapshot.state.nextManager).toBeNull();
      }
    },
  );

  it('PRE_NEGOTIATION 재계약은 현재 계약을 유지하고 새 조건을 nextContract로 보관한다', () => {
    const active = runLoanPrefix(10);
    if (active.state.season === null || active.state.contract === null) throw new Error(`활성 시즌 prefix가 없다: season=${active.state.season !== null} contract=${active.state.contract !== null}`);
    const renewal = makeOffer(active.state, {
      id: 'OFR-pre-renewal',
      kind: 'RENEWAL',
      teamId: active.state.contract.teamId,
      rolePromise: active.state.contract.rolePromise === 'STARTER' ? 'ROTATION' : 'STARTER',
    });
    const offered = rehashSnapshot(active, {
      ...active.state,
      pending: {
        kind: 'CONTRACT',
        step: active.state.season.currentStep,
        offers: [renewal],
        market: { openedAtRevision: active.revision, seasonIndex: active.state.seasonHistory.length, reason: 'PRE_NEGOTIATION', safeOfferId: null },
      },
    });
    const result = runCommand(offered, acceptCommand(offered, renewal.id));
    expect(result.state.contract?.id).toBe(active.state.contract.id);
    expect(result.state.contract?.rolePromise).toBe(active.state.contract.rolePromise);
    expect(result.state.nextContract?.rolePromise).toBe(renewal.rolePromise);
    expect(result.state.pending).toBeNull();
  });

  it('같은 ACCEPT_OFFER를 stale revision으로 다시 보내면 revision 충돌이고 계약/stint는 하나만 추가된다', () => {
    const settled = runSettledFixture().snapshot;
    const offer = makeOffer(settled.state, {
      id: 'OFR-duplicate-transfer',
      kind: 'TRANSFER',
      teamId: otherTeamId(settled.state),
    });
    const offered = withOffers(settled, [offer], 'EXPIRED', offer.id);
    const command = acceptCommand(offered, offer.id);
    const accepted = simulate({
      snapshot: offered,
      command,
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    const duplicate = simulate({
      snapshot: accepted.snapshot,
      command,
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });
    expect(duplicate).toMatchObject({ ok: false, error: { code: 'CAREER_REVISION_CONFLICT' } });
    expect(
      accepted.snapshot.state.clubHistory.filter((stint) => stint.toSeasonIndex === null),
    ).toHaveLength(1);
    expect(accepted.snapshot.state.clubHistory).toHaveLength(offered.state.clubHistory.length + 1);
  });

  it('만료된 제안 ACCEPT_OFFER는 OFFER_EXPIRED로 실패하고 revision을 올리지 않는다', () => {
    const settled = runSettledFixture().snapshot;
    const offer = makeOffer(settled.state, {
      id: 'OFR-expired-accept',
      kind: 'FREE_AGENT',
      teamId: otherTeamId(settled.state),
      validUntilRevision: settled.revision,
    });
    const offered = withOffers(settled, [offer], 'EXPIRED', offer.id);
    const result = simulate({
      snapshot: offered,
      command: acceptCommand(offered, offer.id),
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', details: { reason: 'OFFER_EXPIRED' } },
    });
    expect(offered.revision).toBe(settled.revision);
    expect(offered.stateHash).toBe(hashState(offered.state));
  });

  it('NEGOTIATE 성공·실패 모두 roll을 정확히 1회 소비한다', () => {
    const settled = runSettledFixture().snapshot;
    const teamId = otherTeamId(settled.state);
    const team = rulesetProto.teams.find((candidate) => candidate.id === teamId)!;
    const successBp = Math.max(
      0,
      Math.min(
        10000,
        rulesetProto.transferRules.negotiation.successBp.TRANSFER.WAGE +
          rulesetProto.transferRules.negotiation.reputationAdjustBpPerPoint * (team.reputation - 3),
      ),
    );
    const findSeed = (success: boolean): string => {
      for (let index = 0; index < 1000; index++) {
        const seed = `market-negotiate-${success ? 'success' : 'failure'}-${index}`;
        const roll = rollInt(seedRng(seed), 10000).value;
        if (roll < successBp === success) return seed;
      }
      throw new Error(`could not find ${success ? 'success' : 'failure'} negotiation seed`);
    };

    const run = (success: boolean) => {
      const offer = makeOffer(settled.state, {
        id: `OFR-negotiate-${success ? 'success' : 'failure'}`,
        kind: 'TRANSFER',
        teamId,
        negotiable: { wage: true, role: true, length: true },
      });
      const offered = withOffers(
        rehashSnapshot(settled, { ...settled.state, rngState: seedRng(findSeed(success)) }),
        [offer],
        'EXPIRED',
        offer.id,
      );
      const beforeDraws = offered.state.rngState.draws;
      const result = simulate({
        snapshot: offered,
        command: negotiateCommand(offered, offer.id, 'WAGE'),
        ruleset: rulesetProto,
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.rngState.draws).toBe(beforeDraws + 1);
      expect(result.snapshot.state.timeline.findLast((entry) => entry.kind === 'NEGOTIATED')?.refId).toContain(
        success ? 'COUNTERED' : 'WITHDRAWN',
      );
      if (success) {
        expect(result.snapshot.state.pending?.kind).toBe('OFFERS');
        expect(
          result.snapshot.state.pending?.kind === 'OFFERS' &&
            result.snapshot.state.pending.offers[0]?.negotiationState,
        ).toBe('COUNTERED');
      } else {
        expect(result.snapshot.state.pending).toBeNull();
        expect(result.nextAction).toBe('ADVANCE');
      }
    };

    run(true);
    run(false);
  });

  it('처리기별 빈 pending 실패 reason과 만료 실패 reason을 구분한다', () => {
    const settled = runSettledFixture().snapshot;
    const noPending = rehashSnapshot(settled, { ...settled.state, pending: null });
    const common = { ruleset: rulesetProto, rulesetVersion: '1.0.0', contentPackVersion: '0.1.0' };
    const negotiate = simulate({
      ...common,
      snapshot: noPending,
      command: negotiateCommand(noPending, 'OFR-none', 'WAGE'),
    });
    expect(negotiate).toMatchObject({
      ok: false,
      error: { details: { reason: 'NO_PENDING_OFFERS' } },
    });

    const reject = simulate({
      ...common,
      snapshot: noPending,
      command: {
        type: 'REJECT_OFFER',
        commandId: 'reject-none',
        expectedRevision: noPending.revision,
        payload: { offerId: null },
      },
    });
    expect(reject).toMatchObject({
      ok: false,
      error: { details: { reason: 'NO_PENDING_OFFERS' } },
    });

    const loanReturn = simulate({
      ...common,
      snapshot: noPending,
      command: loanReturnCommand(noPending, 'RETURN'),
    });
    expect(loanReturn).toMatchObject({
      ok: false,
      error: { details: { reason: 'NO_PENDING_LOAN_RETURN' } },
    });

    const nonNegotiableOffer = makeOffer(settled.state, {
      id: 'OFR-not-negotiable',
      kind: 'TRANSFER',
      teamId: otherTeamId(settled.state),
      negotiable: { wage: false, role: false, length: false },
    });
    const nonNegotiablePending = withOffers(
      settled,
      [nonNegotiableOffer],
      'EXPIRED',
      nonNegotiableOffer.id,
    );
    const notNegotiable = simulate({
      ...common,
      snapshot: nonNegotiablePending,
      command: negotiateCommand(nonNegotiablePending, nonNegotiableOffer.id, 'WAGE'),
    });
    expect(notNegotiable).toMatchObject({
      ok: false,
      error: { details: { reason: 'NOT_NEGOTIABLE' } },
    });

    const safeReject = simulate({
      ...common,
      snapshot: nonNegotiablePending,
      command: {
        type: 'REJECT_OFFER',
        commandId: 'reject-safe',
        expectedRevision: nonNegotiablePending.revision,
        payload: { offerId: nonNegotiableOffer.id },
      },
    });
    expect(safeReject).toMatchObject({ ok: false, error: { details: { reason: 'SAFE_OFFER' } } });

    const missingReject = simulate({
      ...common,
      snapshot: nonNegotiablePending,
      command: {
        type: 'REJECT_OFFER',
        commandId: 'reject-missing',
        expectedRevision: nonNegotiablePending.revision,
        payload: { offerId: 'OFR-missing' },
      },
    });
    expect(missingReject).toMatchObject({
      ok: false,
      error: { details: { reason: 'OFFER_NOT_FOUND' } },
    });

    const loaned = runLoanPrefix(15);
    const returnPending = withPendingLoanReturn(loaned, ['RETURN']);
    const unavailableReturn = simulate({
      ...common,
      snapshot: returnPending,
      command: loanReturnCommand(returnPending, 'PERMANENT'),
    });
    expect(unavailableReturn).toMatchObject({
      ok: false,
      error: { details: { reason: 'OPTION_NOT_AVAILABLE' } },
    });
  });

  it('LOAN_RETURN의 RETURN·PERMANENT 분기와 parentRemaining 0 자동 FA 분기를 모두 처리한다', () => {
    const loaned = runLoanPrefix(15);
    const captainLoaned = rehashSnapshot(loaned, {
      ...loaned.state,
      captaincy: 'CAPTAIN',
      captaincySeasons: 4,
    });
    const captainReturnPending = withPendingLoanReturn(captainLoaned, ['RETURN']);
    const returned = simulate({
      snapshot: captainReturnPending,
      command: loanReturnCommand(captainReturnPending, 'RETURN'),
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    expect(returned.snapshot.state.contract?.kind).toBe('PERMANENT');
    expect(returned.snapshot.state.parentContract).toBeNull();
    expect(returned.snapshot.state.timeline.at(-1)?.refId).toBe('RETURN');
    expect(returned.snapshot.state.captaincy).toBe('NONE');
    expect(returned.snapshot.state.captaincySeasons).toBe(0);
    expect(returned.snapshot.state.nextManager).toBeNull();

    const permanentPending = withPendingLoanReturn(captainLoaned, ['RETURN', 'PERMANENT']);
    const permanent = simulate({
      snapshot: permanentPending,
      command: loanReturnCommand(permanentPending, 'PERMANENT'),
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });
    expect(permanent.ok).toBe(true);
    if (!permanent.ok) return;
    expect(permanent.snapshot.state.contract?.kind).toBe('PERMANENT');
    expect(permanent.snapshot.state.contract?.teamId).toBe(loaned.state.contract?.teamId);
    expect(permanent.snapshot.state.parentContract).toBeNull();
    expect(permanent.snapshot.state.timeline.at(-2)?.refId).toBe('PERMANENT');
    expect(permanent.snapshot.state.captaincy).toBe(captainLoaned.state.captaincy);
    expect(permanent.snapshot.state.captaincySeasons).toBe(captainLoaned.state.captaincySeasons);
    expect(permanent.snapshot.state.nextManager).toBe(captainLoaned.state.nextManager);

    const loanState: CareerState = {
      ...loaned.state,
      parentContract: { ...loaned.state.parentContract!, lengthSeasons: 1 },
      context: { tacticalFit: 99, squadStatus: 7, positionProficiency: 66 },
      relationships: {
        ...loaned.state.relationships,
        managerTrust: 12,
        captain: 34,
        rival: 56,
        fans: 100,
      },
    };
    const autoFaStart = rehashSnapshot(loaned, loanState);
    const autoFaSettled = runLoanFixtureCommands(autoFaStart, 15, 20);
    expect(autoFaSettled.state.pending?.kind).toBe('OFFERS');
    expect(
      autoFaSettled.state.pending?.kind === 'OFFERS' && autoFaSettled.state.pending.market.reason,
    ).toBe('EXPIRED');
    expect(autoFaSettled.state.timeline.at(-1)?.refId).toBe('RETURN');
    expect(autoFaSettled.state.captaincy).toBe('NONE');
    expect(autoFaSettled.state.captaincySeasons).toBe(0);
    expect(autoFaSettled.state.nextManager).toBeNull();
    expect(autoFaSettled.state.context).toEqual({
      tacticalFit: rulesetProto.offerRules.tacticalFitEstimate.min,
      squadStatus:
        rulesetProto.contractRules.squadStatusByRole[loanState.parentContract!.rolePromise],
      positionProficiency: 66,
    });
    expect(autoFaSettled.state.relationships).toEqual({
      managerTrust: rulesetProto.transferRules.relationshipCarry.newManagerTrustBase,
      captain: 0,
      rival: 0,
      // Parent-contract expiry opens FA without applying the return fan carry;
      // the carry is applied exactly once when a new club is accepted.
      fans: loanState.relationships.fans,
      agent: loanState.relationships.agent,
    });

    const safeOffer =
      autoFaSettled.state.pending?.kind === 'OFFERS'
        ? autoFaSettled.state.pending.offers[0]!
        : null;
    if (safeOffer === null) throw new Error('automatic FA market did not contain a safe offer');
    const afterSafeRenewal = runCommand(autoFaSettled, acceptCommand(autoFaSettled, safeOffer.id));
    expect(afterSafeRenewal.state.contract?.teamId).toBe(loanState.parentContract!.teamId);
    expect(afterSafeRenewal.state.context).toEqual(autoFaSettled.state.context);
    expect(afterSafeRenewal.state.relationships).toEqual(autoFaSettled.state.relationships);
    const freeAgent =
      autoFaSettled.state.pending?.kind === 'OFFERS'
        ? autoFaSettled.state.pending.offers.find((offer) => offer.kind === 'FREE_AGENT')
        : undefined;
    if (freeAgent === undefined) throw new Error('automatic FA market did not contain a FREE_AGENT offer');
    const afterFreeAgent = runCommand(autoFaSettled, acceptCommand(autoFaSettled, freeAgent.id));
    expect(afterFreeAgent.state.clubHistory.at(-2)?.toSeasonIndex).toBeGreaterThanOrEqual(
      afterFreeAgent.state.clubHistory.at(-2)?.fromSeasonIndex ?? 0,
    );
    expect(afterFreeAgent.state.relationships.fans).toBe(
      Math.floor((autoFaSettled.state.relationships.fans * rulesetProto.transferRules.relationshipCarry.fansCarryBp) / 10000),
    );
  });

  it('강제 감독 교체가 예약된 임대 결산→PERMANENT→START_SEASON에서 감독·신뢰·전술·선발·주장단을 보존한다', () => {
    const forcedRuleset = {
      ...rulesetProto,
      // This regression isolates settlement manager reservation from the unrelated
      // T-4-002 forced-injury decision that can block the fixture's ADVANCE tail.
      injuryRules: {
        ...rulesetProto.injuryRules,
        maxForcedPerSeason: 0,
      },
      managerRules: {
        ...rulesetProto.managerRules,
        changeProbability: {
          ...rulesetProto.managerRules.changeProbability,
          baseBp: 10000,
          maxBp: 10000,
        },
      },
    };
    const loaned = runLoanPrefix(15);
    const captaincyState = rehashSnapshot(loaned, {
      ...loaned.state,
      relationships: { ...loaned.state.relationships, managerTrust: 83 },
      captaincy: 'CAPTAIN',
      captaincySeasons: 4,
    });

    // career-11 명령을 임대 구단 시즌 시작부터 결산 직전까지 그대로 재생한다. 매입 옵션이
    // 열리는 실제 결산 경계를 고정하기 위해 해당 시즌의 기록된 가능 시간만큼 출전 시간을 채운다.
    const beforeSettlement = runLoanFixtureCommands(captaincyState, 15, 19, forcedRuleset);
    const loanSeason = beforeSettlement.state.season;
    const loanContract = beforeSettlement.state.contract;
    if (loanSeason === null || loanContract === null || loanContract.loan === null) {
      throw new Error('loan season or buy option is missing before settlement');
    }
    const possibleMinutes = loanSeason.schedule.filter((entry) => entry.skipped === undefined).length * 90;
    const settledInput = rehashSnapshot(beforeSettlement, {
      ...beforeSettlement.state,
      contract: {
        ...loanContract,
        loan: { ...loanContract.loan, buyOptionMinor: 120_000_000 },
      },
      season: {
        ...loanSeason,
        playerStats: { ...loanSeason.playerStats, minutes: possibleMinutes },
      },
    });
    const settled = runLoanFixtureCommands(settledInput, 19, 20, forcedRuleset);
    const loanTeamId = settled.state.contract?.teamId;
    if (loanTeamId === undefined) throw new Error('loan settlement did not keep a contract');
    const replacementId = `${loanTeamId}-mgr-2`;
    const settledManagerTrust = settled.state.relationships.managerTrust;

    expect(settled.state.pending?.kind).toBe('LOAN_RETURN');
    expect(settled.state.nextManager?.id).toBe(replacementId);
    expect(settled.state.timeline).toContainEqual(
      expect.objectContaining({ kind: 'MANAGER_CHANGED', refId: replacementId }),
    );

    const permanent = runCommand(
      settled,
      loanReturnCommand(settled, 'PERMANENT'),
      forcedRuleset,
    );
    expect(permanent.state.contract?.teamId).toBe(loanTeamId);
    expect(permanent.state.nextManager?.id).toBe(replacementId);
    expect(permanent.state.captaincy).toBe('CAPTAIN');
    expect(permanent.state.captaincySeasons).toBe(5);
    expect(permanent.state.relationships.managerTrust).toBe(settledManagerTrust);

    const started = runLoanFixtureCommands(permanent, 21, 22, forcedRuleset);
    const season = started.state.season;
    const profile = started.state.player.profile;
    const team = forcedRuleset.teams.find((candidate) => candidate.id === loanTeamId);
    const manager = permanent.state.nextManager;
    if (season === null || profile === null || team === undefined || manager === null) {
      throw new Error('PERMANENT START_SEASON did not create the expected team state');
    }
    const expectedTacticalFit = computeTacticalFit(
      permanent.state.attributes,
      profile.archetypeId,
      profile.primaryPosition,
      findTacticalStyle(forcedRuleset, team.tacticalStyleId),
      forcedRuleset.selectionRules,
      manager.preferredArchetypeIds,
    );
    const playerCandidate = season.selection.candidates.find((candidate) => candidate.id === 'PLAYER');

    expect(season.manager?.id).toBe(replacementId);
    expect(started.state.relationships.managerTrust).toBe(forcedRuleset.managerRules.trustBase);
    expect(started.state.context.tacticalFit).toBe(expectedTacticalFit);
    expect(playerCandidate).toMatchObject({
      tacticalFit: expectedTacticalFit,
      managerTrust: forcedRuleset.managerRules.trustBase,
    });
    expect(started.state.captaincy).toBe('CAPTAIN');
    expect(started.state.captaincySeasons).toBe(5);
  });
});
