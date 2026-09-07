import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CareerState, Offer } from '@offside/domain';
import { CompactOfferCard, offerHeadlineRows } from './contract-presentation.js';

// T-7-013: CompactOfferCard가 Link를 렌더하므로(RouterProvider 없이) Link를 단순 <a>로
// 대체한다. retirement-screen.test.tsx와 같은 패턴.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a href="#" {...props}>
      {children}
    </a>
  ),
}));

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
    expect(rows[5]?.value).toBe('제한 없음');
  });

  it('T-7-007(이슈 151): 결정 기한 셀은 짧은 값으로 고정된다', () => {
    const state = { timeline: [], contract: null } as unknown as CareerState;
    const limited = offerHeadlineRows({ ...offer, validUntilRevision: 4 }, state, 1, null);
    expect(limited.find((row) => row.label === '결정 기한')?.value).toBe('결정 3번 안');

    const unlimited = offerHeadlineRows({ ...offer, validUntilRevision: null }, state, 1, null);
    expect(unlimited.find((row) => row.label === '결정 기한')?.value).toBe('제한 없음');

    const expired = offerHeadlineRows({ ...offer, validUntilRevision: 3 }, state, 5, null);
    expect(expired.find((row) => row.label === '결정 기한')?.value).toBe('만료');

    const atBoundary = offerHeadlineRows({ ...offer, validUntilRevision: 5 }, state, 5, null);
    expect(atBoundary.find((row) => row.label === '결정 기한')?.value).toBe('만료');

    const remainingTwo = offerHeadlineRows({ ...offer, validUntilRevision: 7 }, state, 5, null);
    expect(remainingTwo.find((row) => row.label === '결정 기한')?.value).toBe('결정 2번 안');
  });

  it('labels the same fields as a first contract when no current contract exists', () => {
    const rows = offerHeadlineRows(offer, { contract: null } as unknown as CareerState, 0, null);
    expect(rows[3]?.delta).toBe('첫 프로 계약');
    expect(rows[4]?.delta).toBe('첫 프로 계약');
  });

  // T-7-013: axe definition-list/only-dlitems — <dl>의 직접 자식은 div(dt+dd 묶음)만
  // 허용된다(HTML dl 콘텐츠 모델). CompactOfferCard의 헤드라인 dl이 그 구조를 지키는지 확인.
  it('제안 카드 헤드라인 dl은 div(dt+dd) 묶음만 직접 자식으로 둔다', () => {
    const state = { contract: null, pending: null, rulesetVersion: '1.0.0', timeline: [] } as unknown as CareerState;
    const { container } = render(
      <CompactOfferCard careerId="career-1" offer={offer} state={state} recordRevision={0} safeOfferId={null} parentTeamName={null} />,
    );
    const dl = container.querySelector('dl');
    expect(dl).not.toBeNull();
    const children = Array.from(dl!.children);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(child.tagName).toBe('DIV');
      expect(Array.from(child.children).map((el) => el.tagName)).toEqual(['DT', 'DD']);
    }
  });
});
