import { describe, expect, it } from 'vitest';
import { canNegotiate, expireOffers, isOfferExpired } from './negotiation.js';
import type { Offer } from './types.js';

function buildTestOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'OFR-TEST-1',
    kind: 'RENEWAL',
    teamId: 'seoul-tier1',
    teamName: 'Seoul',
    fromTeamId: 'seoul-tier1',
    leagueTier: 1,
    lengthSeasons: 2,
    wageMinorPerWeek: 1000,
    signingBonusMinor: 0,
    transferFeeMinor: null,
    rolePromise: 'BENCH',
    appearancePromise: { minutesShareBp: 2000 },
    positionPlan: 'ST',
    shirtNumber: 9,
    tacticalFitEstimate: 50,
    competitorSummary: null,
    validUntilRevision: null,
    negotiable: { wage: false, role: false, length: false },
    negotiationState: 'OPEN',
    negotiatedAsk: null,
    loan: null,
    ...overrides,
  };
}

describe('isOfferExpired', () => {
  it('validUntilRevision === revision이면 아직 유효하다', () => {
    const offer = buildTestOffer({ validUntilRevision: 10 });
    expect(isOfferExpired(offer, 10)).toBe(false);
  });

  it('revision > validUntilRevision이면 만료다', () => {
    const offer = buildTestOffer({ validUntilRevision: 10 });
    expect(isOfferExpired(offer, 11)).toBe(true);
  });

  it('validUntilRevision === null이면 절대 만료되지 않는다', () => {
    const offer = buildTestOffer({ validUntilRevision: null });
    expect(isOfferExpired(offer, 999999)).toBe(false);
  });
});

describe('expireOffers', () => {
  it('validUntilRevision: null인 안전 잔류 제안은 절대 kept에 남고 expired로 가지 않는다', () => {
    const safe = buildTestOffer({ id: 'OFR-SAFE', validUntilRevision: null });
    const expiring = buildTestOffer({ id: 'OFR-EXPIRING', validUntilRevision: 5 });
    const { kept, expired } = expireOffers([safe, expiring], 6);
    expect(kept).toEqual([safe]);
    expect(expired).toEqual([expiring]);
  });

  it('원래 순서를 유지한다', () => {
    const a = buildTestOffer({ id: 'OFR-A', validUntilRevision: null });
    const b = buildTestOffer({ id: 'OFR-B', validUntilRevision: null });
    const { kept } = expireOffers([a, b], 1);
    expect(kept.map((offer) => offer.id)).toEqual(['OFR-A', 'OFR-B']);
  });
});

describe('canNegotiate', () => {
  it('OPEN이고 negotiable 중 하나라도 참이면 true다', () => {
    const offer = buildTestOffer({ negotiationState: 'OPEN', negotiable: { wage: true, role: false, length: false } });
    expect(canNegotiate(offer)).toBe(true);
  });

  it('negotiable이 전부 false면 OPEN이어도 false다', () => {
    const offer = buildTestOffer({ negotiationState: 'OPEN', negotiable: { wage: false, role: false, length: false } });
    expect(canNegotiate(offer)).toBe(false);
  });

  it('COUNTERED면 negotiable이 있어도 false다', () => {
    const offer = buildTestOffer({ negotiationState: 'COUNTERED', negotiable: { wage: true, role: true, length: true } });
    expect(canNegotiate(offer)).toBe(false);
  });

  it('WITHDRAWN이면 negotiable이 있어도 false다', () => {
    const offer = buildTestOffer({ negotiationState: 'WITHDRAWN', negotiable: { wage: true, role: true, length: true } });
    expect(canNegotiate(offer)).toBe(false);
  });
});
