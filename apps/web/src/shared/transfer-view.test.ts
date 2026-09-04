import type { CareerState, Offer } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import {
  actionableRevision,
  buildCurrentContractSummary,
  buildNegotiationResultView,
  buildOfferRows,
  canAcceptOffer,
  canNegotiateOffer,
  negotiationKey,
  offerStatus,
} from './transfer-view.js';

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'OFR-1',
    kind: 'TRANSFER',
    teamId: 'team-new',
    teamName: '새 팀',
    fromTeamId: 'team-old',
    leagueTier: 1,
    lengthSeasons: 2,
    wageMinorPerWeek: 1000,
    signingBonusMinor: 10,
    transferFeeMinor: 50_000,
    rolePromise: 'ROTATION',
    appearancePromise: { minutesShareBp: 4500 },
    positionPlan: 'W',
    shirtNumber: 7,
    tacticalFitEstimate: 62,
    competitorSummary: null,
    validUntilRevision: 10,
    negotiable: { wage: false, role: false, length: false },
    negotiationState: 'OPEN',
    negotiatedAsk: null,
    loan: null,
    ...overrides,
  };
}

describe('T-3-005 negotiation ask mapping', () => {
  it.each([
    ['WAGE', 'wage'],
    ['ROLE', 'role'],
    ['LENGTH', 'length'],
  ] as const)('maps %s to %s without a cast', (ask, key) => {
    expect(negotiationKey(ask)).toBe(key);
  });

  it.each([
    ['WAGE', { wage: true, role: false, length: false }],
    ['ROLE', { wage: false, role: true, length: false }],
    ['LENGTH', { wage: false, role: false, length: true }],
  ] as const)('%s only follows its mapped true/false flag', (ask, negotiable) => {
    const candidate = offer({ negotiable });
    expect(canNegotiateOffer(candidate, 5, ask)).toBe(true);
    const otherAsks = (['WAGE', 'ROLE', 'LENGTH'] as const).filter((value) => value !== ask);
    for (const other of otherAsks) expect(canNegotiateOffer(candidate, 5, other)).toBe(false);
  });
});

describe('T-3-005 revision-based offer state', () => {
  it('validUntilRevision은 currentStep가 아니라 snapshot revision으로 만료를 판정한다', () => {
    const candidate = offer({ validUntilRevision: 10 });
    expect(offerStatus(candidate, 9)).toBe('OPEN');
    expect(canAcceptOffer(candidate, 9)).toBe(true);
    expect(offerStatus(candidate, 11)).toBe('EXPIRED');
    expect(canAcceptOffer(candidate, 11)).toBe(false);
  });

  it('currentStep=7이어도 record revision=11이면 이미 만료된 제안으로 표시한다', () => {
    const rows = buildOfferRows([offer({ validUntilRevision: 10 })], 11, null);
    expect(rows.find((row) => row.id === 'status')?.cells[0]?.value).toBe('만료됨');
  });

  it('validUntilRevision === current record revision이면 다음 명령 revision에서 만료되어 액션을 막는다', () => {
    const candidate = offer({ validUntilRevision: 10, negotiable: { wage: true, role: true, length: true } });
    expect(actionableRevision(10)).toBe(11);
    expect(offerStatus(candidate, actionableRevision(10))).toBe('EXPIRED');
    expect(canAcceptOffer(candidate, 10)).toBe(false);
    for (const ask of ['WAGE', 'ROLE', 'LENGTH'] as const) expect(canNegotiateOffer(candidate, 10, ask)).toBe(false);
    const rows = buildOfferRows([candidate], 10, null);
    expect(rows.find((row) => row.id === 'status')?.cells[0]?.value).toBe('만료됨');
    expect(rows.find((row) => row.id === 'validity')?.cells[0]?.value).toContain('다음 결정에서 만료');
  });
});

describe('T-3-005 current contract summary', () => {
  it('진행 중 시즌의 SEASON_STARTED까지 정본 함수로 잔여 시즌을 계산한다', () => {
    const state = {
      contract: { lengthSeasons: 1, signedAtRevision: 3, rolePromise: 'STARTER', teamName: '현재 팀', leagueTier: 1, wageMinorPerWeek: 1000, promiseBreaches: 0 },
      seasonHistory: [
        { result: { promiseFulfilment: { fulfilled: true } } },
        { result: { promiseFulfilment: { fulfilled: false } } },
      ],
      timeline: [{ revision: 4, kind: 'SEASON_STARTED' }],
    } as CareerState;
    expect(buildCurrentContractSummary(state).find((item) => item.label === '남은 계약')?.value).toBe('0시즌');
    expect(buildCurrentContractSummary(state).find((item) => item.label === '현재 역할')?.value).toBe('주전');
    expect(buildCurrentContractSummary(state).find((item) => item.label === '출전 약속 이행/위반')?.value).toBe('이행 1회 · 위반 0회');
  });
});

describe('T-3-005 loan display projection', () => {
  it('LOAN 조건은 parentTeamId 대신 현재 공개 teamName을 보여준다', () => {
    const candidate = offer({
      kind: 'LOAN',
      teamId: 'team-loan',
      teamName: '임대 팀',
      fromTeamId: null,
      transferFeeMinor: null,
      loan: { parentTeamId: 'internal-parent-id', seasons: 1, wageShareBp: 5000, buyOptionMinor: 120_000 },
    });
    const loanRow = buildOfferRows([candidate], 2, null, '현재 팀').find((row) => row.id === 'loan');
    expect(loanRow?.cells[0]?.value).toContain('현재 팀');
    expect(loanRow?.cells[0]?.value).not.toContain('internal-parent-id');
  });
});

describe('T-3-005 negotiation result projection', () => {
  it('COUNTERED는 명령 전·후 조건과 남은 대안을 저장 snapshot에서 보여준다', () => {
    const before = offer({ id: 'OFR-COUNTER', teamName: '협상 팀', wageMinorPerWeek: 1000 });
    const after = { ...before, wageMinorPerWeek: 1200, negotiationState: 'COUNTERED' as const, negotiatedAsk: 'WAGE' as const };
    const snapshot = {
      revision: 11,
      state: {
        timeline: [{ revision: 11, kind: 'NEGOTIATED', refId: 'OFR-COUNTER:WAGE:COUNTERED' }],
        pending: { kind: 'OFFERS', offers: [after, offer({ id: 'OFR-OTHER', teamName: '다른 팀', validUntilRevision: null })] },
      },
    } as never;
    const view = buildNegotiationResultView(before, snapshot);
    expect(view).toMatchObject({ outcome: 'COUNTERED', askLabel: '주급', before: '1,000원', after: '1,200원' });
    expect(view?.remainingOffers.map((candidate) => candidate.teamName)).toEqual(['다른 팀']);
  });

  it('WITHDRAWN은 ask 기반 철회 원인과 남은 제안을 보여주며 임의의 상태를 만들지 않는다', () => {
    const before = offer({ id: 'OFR-WITHDRAWN', teamName: '철회 팀', wageMinorPerWeek: 1000 });
    const snapshot = {
      revision: 11,
      state: {
        timeline: [{ revision: 11, kind: 'NEGOTIATED', refId: 'OFR-WITHDRAWN:ROLE:WITHDRAWN' }],
        pending: { kind: 'OFFERS', offers: [offer({ id: 'OFR-SAFE', teamName: '현재 팀', kind: 'RENEWAL', validUntilRevision: null })] },
      },
    } as never;
    const view = buildNegotiationResultView(before, snapshot);
    expect(view).toMatchObject({ outcome: 'WITHDRAWN', askLabel: '역할', before: '로테이션', after: '—' });
    expect(view?.reason).toContain('수용되지 않아');
    expect(view?.remainingOffers.map((candidate) => candidate.teamName)).toEqual(['현재 팀']);
  });
});
