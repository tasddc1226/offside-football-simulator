import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CareerState, Command, LegacyResult } from '@offside/domain';
import { RetirementScreen } from './retirement-screen.js';

vi.mock('@tanstack/react-router', () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a href="#" {...props}>{children}</a> }));

const state = { careerId: 'career-test', status: 'RETIRED', seasonHistory: [], timeline: [], season: null, pending: null, nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [], serviceStatus: 'NOT_APPLICABLE', route: null, startSeasonIndex: null, completedSeasonIndex: null }, player: { profile: { name: '공개 선수', gender: 'MALE', nationalityCode: 'KR', preferredFoot: 'RIGHT', primaryPosition: 'ST', preferredPosition: 'ST', archetypeId: 'x', backgroundId: 'x', baseOvr: 77 } } } as unknown as CareerState;
const result = { totalScore: 80, bandId: 'BAND-ICON', endingId: 'END-COMPLETE-SHORT', componentScores: { achievement: 1, contribution: 2, longevity: 3, relationship: 4, narrative: 5 }, topFactors: [], missedOpportunity: { component: 'achievement', sourceIds: [], reasonTag: 'LEGACY_ACHIEVEMENT', value: 1 }, bestMomentRef: 'retirement', percentileHidden: true, sources: [], tags: [], coverage: { income: 'UNAVAILABLE' } } as unknown as LegacyResult;

const activeState = { ...state, status: 'ACTIVE', age: 24, state: { fitness: 80 }, contract: null, relationships: { captain: 0 }, legacyEvents: { policyVersion: '1.0.0', tournaments: [], mentoredSeasonIndices: [] }, seasonHistory: [{ index: 0, result: { playerStats: { injuries: 0, appearances: { total: 10 }, minutes: 900, ratedMatches: 10, ratingSumTenths: 700 }, competitions: [], selectionSummary: { possibleMinutes: 900 } } }], season: null, pending: null } as unknown as CareerState;

describe('RetirementScreen terminal public views', () => {
  it('hides retirement actions and renders public profile fields and four navigation links', () => {
    render(<RetirementScreen state={state} result={result} mode="final-profile" />);
    expect(screen.queryByRole('button', { name: /은퇴/ })).not.toBeInTheDocument();
    expect(screen.getByText('공개 선수')).toBeInTheDocument();
    expect(screen.getByText(/선호 포지션 스트라이커/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Legacy Score' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '연대기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '최종 프로필' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '통산 기록' })).toBeInTheDocument();
    expect(screen.queryByText(/potential|잠재력/i)).not.toBeInTheDocument();
  });
});

describe('RetirementScreen active confirmation', () => {
  it('confirms RETIRE, allows cancellation, and prevents duplicate commits while busy', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onCommand = vi.fn<(command: Command) => Promise<void>>(() => new Promise<void>((done) => { resolve = done; }));
    render(<RetirementScreen state={activeState} onCommand={onCommand} />);

    await user.click(screen.getByRole('button', { name: '선수 생활 마무리' }));
    expect(screen.getByRole('heading', { name: '마지막 휘슬을 불까요?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '은퇴 확정' }));
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ type: 'RETIRE', payload: { choice: 'RETIRE' } });
    expect(screen.getByRole('button', { name: '은퇴 확정' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '은퇴 확정' }));
    expect(onCommand).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(screen.queryByRole('heading', { name: '마지막 휘슬을 불까요?' })).not.toBeInTheDocument());
  });

  it('cancels without a command and surfaces a failed confirmation', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn<(command: Command) => Promise<void>>().mockRejectedValue(new Error('저장 실패'));
    render(<RetirementScreen state={activeState} onCommand={onCommand} />);

    await user.click(screen.getByRole('button', { name: '선수 생활 마무리' }));
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: '마지막 휘슬을 불까요?' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '선수 생활 마무리' }));
    await user.click(screen.getByRole('button', { name: '지도자 에필로그로 마무리' }));
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('저장 실패'));
    expect(onCommand).toHaveBeenCalledWith({ type: 'RETIRE', payload: { choice: 'COACH_EPILOGUE' } });
  });
});
