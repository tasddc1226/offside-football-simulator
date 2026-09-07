import type { CareerState, Offer } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import {
  actionableRevision,
  buildCurrentContractSummary,
  buildNegotiationResultView,
  buildOfferRows,
  canAcceptOffer,
  canNegotiateOffer,
  negotiationDisabledReason,
  negotiationKey,
  offerStatus,
  offerProjectionNotice,
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
  it('1.1 제안은 계약 약속과 예상치를 구분하고 사전 재계약은 다음 시즌 순위를 약속하지 않는다', () => {
    expect(offerProjectionNotice('1.1.0', 'INTEREST')).toContain('시즌 시작 시점의 예상');
    expect(offerProjectionNotice('1.1.0', 'INTEREST')).toContain('조건이 바뀌면 달라질 수');
    expect(offerProjectionNotice('1.1.0', 'PRE_NEGOTIATION')).toContain('다음 시즌 경쟁 순위를 예측하지 않습니다');
    expect(offerProjectionNotice('1.0.0', 'INTEREST')).toBeNull();
  });

  it('경쟁자 OVR 값을 내 선수 기준 차이로 표시하고 부호를 보존한다', () => {
    const rows = buildOfferRows(
      [
        offer({ competitorSummary: { rank: 3, ovrGap: 0 } }),
        offer({ id: 'OFR-2', competitorSummary: { rank: 1, ovrGap: 2 } }),
        offer({ id: 'OFR-3', competitorSummary: { rank: 4, ovrGap: -3 } }),
      ],
      5,
      null,
    );

    expect(rows.find((row) => row.id === 'competitor')?.cells.map((cell) => cell.value)).toEqual([
      '3위 · OVR 차이 0 (내 선수 기준)',
      '1위 · OVR 차이 +2 (내 선수 기준)',
      '4위 · OVR 차이 -3 (내 선수 기준)',
    ]);
  });

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
    expect(rows.find((row) => row.id === 'validity')?.cells[0]?.value).toBe('다음 결정에서 만료됩니다 · 지금 처리할 수 없습니다');
  });

  it('유효 기간은 협상 횟수가 아니라 확정 결정을 기준으로 안내한다', () => {
    const rows = buildOfferRows([offer({ validUntilRevision: 10 })], 9, null);
    const validity = rows.find((row) => row.id === 'validity')?.cells[0]?.value;
    expect(validity).toContain('앞으로 1번의 결정 안에 처리해야 합니다');
    expect(validity).toContain('화면을 보는 것만으로는 줄지 않습니다');
  });
});

// T-7-004 D-69(이슈 #141): 우선순위 순 — OPEN 아님 → 이 제안 유형에서 협상 불가 → 1회 소진 → 이미 주전 → null.
describe('T-7-004 negotiationDisabledReason', () => {
  it('OPEN이 아니면(철회·만료·이미 협상됨) 사유는 "OPEN 아님"이 가장 먼저 온다', () => {
    const withdrawn = offer({ negotiationState: 'WITHDRAWN', negotiable: { wage: true, role: true, length: true } });
    expect(negotiationDisabledReason(withdrawn, 5, 'WAGE')).toBe('이 제안은 더 이상 열려 있지 않습니다');
  });

  it('OPEN이지만 이 ask가 negotiable하지 않으면 제안 유형 문구를 돌려준다', () => {
    const notNegotiable = offer({ negotiable: { wage: false, role: false, length: false } });
    expect(negotiationDisabledReason(notNegotiable, 5, 'WAGE')).toBe('이 제안 유형에서는 주급 협상이 열리지 않습니다');
  });

  it('negotiable해도 이미 다른 ask로 협상 기회를 썼으면 1회 소진 사유를 돌려준다', () => {
    const alreadyNegotiated = offer({
      negotiable: { wage: true, role: false, length: false },
      negotiatedAsk: 'ROLE',
    });
    expect(negotiationDisabledReason(alreadyNegotiated, 5, 'WAGE')).toBe('협상 기회 1회를 이미 사용했습니다');
  });

  it('ROLE 협상은 이미 주전이면 도메인 NOT_NEGOTIABLE과 같은 이유로 막는다', () => {
    const alreadyStarter = offer({ negotiable: { wage: false, role: true, length: false }, rolePromise: 'STARTER' });
    expect(negotiationDisabledReason(alreadyStarter, 5, 'ROLE')).toBe('이미 최고 역할(주전)입니다');
  });

  it('네 조건을 모두 벗어나면 null(활성)을 돌려준다', () => {
    const negotiable = offer({ negotiable: { wage: true, role: false, length: false } });
    expect(negotiationDisabledReason(negotiable, 5, 'WAGE')).toBeNull();
  });
});

describe('T-3-005 current contract summary', () => {
  it('현재 계약에 속한 시즌만 이행 횟수에 포함하고 이전 계약 시즌은 섞지 않는다', () => {
    const state = {
      contract: {
        id: 'CTR-CURRENT',
        lengthSeasons: 1,
        signedAtRevision: 3,
        signedSeasonIndex: 2,
        rolePromise: 'STARTER',
        teamId: 'team-current',
        teamName: '현재 팀',
        leagueTier: 1,
        wageMinorPerWeek: 1000,
        promiseBreaches: 0,
      },
      clubHistory: [
        {
          teamId: 'team-current',
          teamName: '현재 팀',
          leagueTier: 1,
          kind: 'PERMANENT',
          fromSeasonIndex: 2,
          toSeasonIndex: null,
          endReason: null,
          contractId: 'CTR-CURRENT',
        },
      ],
      seasonHistory: [
        { index: 1, teamId: 'team-previous', result: { promiseFulfilment: { fulfilled: true } } },
        { index: 2, teamId: 'team-current', result: { promiseFulfilment: { fulfilled: false } } },
      ],
      timeline: [{ revision: 4, kind: 'SEASON_STARTED' }],
    } as CareerState;
    expect(buildCurrentContractSummary(state).find((item) => item.label === '남은 계약')?.value).toBe('0시즌');
    expect(buildCurrentContractSummary(state).find((item) => item.label === '현재 역할')?.value).toBe('주전');
    expect(buildCurrentContractSummary(state).find((item) => item.label === '출전 약속 이행/위반')?.value).toBe('이행 0회 · 위반 0회');
  });

  it('임대 중 제외된 시즌은 빼고 복귀한 부모 계약의 시즌만 이행 횟수에 포함한다', () => {
    const state = {
      contract: {
        id: 'CTR-PARENT',
        lengthSeasons: 3,
        signedAtRevision: 1,
        signedSeasonIndex: 1,
        rolePromise: 'STARTER',
        teamId: 'team-parent',
        teamName: '원소속 팀',
        leagueTier: 1,
        wageMinorPerWeek: 1000,
        promiseBreaches: 0,
      },
      clubHistory: [
        {
          teamId: 'team-parent',
          teamName: '원소속 팀',
          leagueTier: 1,
          kind: 'PERMANENT',
          fromSeasonIndex: 1,
          toSeasonIndex: 1,
          endReason: 'LOANED',
          contractId: 'CTR-PARENT',
        },
        {
          teamId: 'team-loan',
          teamName: '임대 팀',
          leagueTier: 2,
          kind: 'LOAN',
          fromSeasonIndex: 2,
          toSeasonIndex: 2,
          endReason: 'RETURNED',
          contractId: 'CTR-LOAN',
        },
        {
          teamId: 'team-parent',
          teamName: '원소속 팀',
          leagueTier: 1,
          kind: 'PERMANENT',
          fromSeasonIndex: 3,
          toSeasonIndex: null,
          endReason: null,
          contractId: 'CTR-PARENT',
        },
      ],
      seasonHistory: [
        { index: 1, teamId: 'team-parent', result: { promiseFulfilment: { fulfilled: true } } },
        { index: 2, teamId: 'team-loan', result: { promiseFulfilment: { fulfilled: true } } },
        { index: 3, teamId: 'team-parent', result: { promiseFulfilment: { fulfilled: false } } },
      ],
      timeline: [],
    } as unknown as CareerState;
    expect(buildCurrentContractSummary(state).find((item) => item.label === '출전 약속 이행/위반')?.value).toBe('이행 1회 · 위반 0회');
  });

  it.each(['contract.id', 'contract.signedSeasonIndex', 'state.clubHistory'] as const)(
    '구형/부분 snapshot에서 %s가 없으면 예외나 거짓 0회 대신 missing value를 표시한다',
    (missingField) => {
      const legacyState: Record<string, unknown> = {
        contract: {
          id: 'CTR-LEGACY',
          lengthSeasons: 1,
          signedAtRevision: 1,
          signedSeasonIndex: 1,
          rolePromise: 'STARTER',
          teamId: 'team-current',
          teamName: '현재 팀',
          leagueTier: 1,
          wageMinorPerWeek: 1000,
          promiseBreaches: 0,
        },
        clubHistory: [
          {
            teamId: 'team-current',
            teamName: '현재 팀',
            leagueTier: 1,
            kind: 'PERMANENT',
            fromSeasonIndex: 1,
            toSeasonIndex: null,
            endReason: null,
            contractId: 'CTR-LEGACY',
          },
        ],
        seasonHistory: [{ index: 1, teamId: 'team-current', result: { promiseFulfilment: { fulfilled: true } } }],
        timeline: [{ revision: 2, kind: 'SEASON_STARTED' }],
      };

      if (missingField === 'state.clubHistory') {
        delete legacyState.clubHistory;
      } else {
        const legacyContract = legacyState.contract;
        if (typeof legacyContract !== 'object' || legacyContract === null || Array.isArray(legacyContract)) {
          throw new Error('legacy test fixture contract must be an object');
        }
        const legacyContractRecord = legacyContract as Record<string, unknown>;
        delete legacyContractRecord[missingField === 'contract.id' ? 'id' : 'signedSeasonIndex'];
      }

      // decodeSnapshot은 envelope만 검사하므로, legacy/partial state를 의도적으로 unknown으로 전달한다.
      const state = legacyState as unknown as CareerState;
      const fulfilmentValue = () =>
        buildCurrentContractSummary(state).find((item) => item.label === '출전 약속 이행/위반')?.value;
      expect(fulfilmentValue).not.toThrow();
      expect(fulfilmentValue()).toBe('이행 — · 위반 0회');
    },
  );
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
