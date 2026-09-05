import { describe, expect, it } from 'vitest';
import type { CareerState, Offer } from '@offside/domain';
import { offerHeadlineRows } from './contract-presentation.js';

const offer: Offer = {
  id: 'offer-1', kind: 'TRANSFER', teamId: 'new', teamName: '새 팀', fromTeamId: 'old', leagueTier: 1,
  lengthSeasons: 3, wageMinorPerWeek: 7_000_000, signingBonusMinor: 0, transferFeeMinor: null,
  rolePromise: 'STARTER', appearancePromise: { minutesShareBp: 7000 }, positionPlan: 'W', shirtNumber: 7,
  tacticalFitEstimate: 75, competitorSummary: null, validUntilRevision: null,
  negotiable: { wage: true, role: true, length: true }, negotiationState: 'OPEN', negotiatedAsk: null, loan: null,
};

describe('contract presentation', () => {
  it('puts role, opportunity, wage/term and current deltas in the headline', () => {
    const state = {
      timeline: [],
      contract: { teamName: '현재 팀', leagueTier: 2, rolePromise: 'ROTATION', wageMinorPerWeek: 5_000_000, lengthSeasons: 2, signedAtRevision: 0 },
    } as unknown as CareerState;
    const rows = offerHeadlineRows(offer, state, 0, null);
    expect(rows.map((row) => row.label)).toEqual(['제안', '리그', '역할 · 출전 약속', '주급', '기간', '결정 기한']);
    expect(rows[2]?.value).toContain('70%');
    expect(rows[3]?.delta).toContain('+');
    expect(rows[4]?.delta).toBe('남은 2시즌 대비 +1시즌');
  });

  it('labels the same fields as a first contract when no current contract exists', () => {
    const rows = offerHeadlineRows(offer, { contract: null } as unknown as CareerState, 0, null);
    expect(rows[3]?.delta).toBe('첫 프로 계약');
    expect(rows[4]?.delta).toBe('첫 프로 계약');
  });
});
