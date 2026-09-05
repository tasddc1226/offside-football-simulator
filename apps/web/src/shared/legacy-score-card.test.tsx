import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LegacyResult } from '@offside/domain';
import { LegacyScoreCard } from './legacy-score-card.js';

const result = {
  endingId: 'END-ONE-CLUB-LEGEND',
  totalScore: 88,
  bandId: 'BAND-ICON',
  componentScores: { achievement: 70, contribution: 88, longevity: 91, relationship: 82, narrative: 75 },
  topFactors: [
    { component: 'contribution', sourceIds: ['season:7:performance'], reasonTag: 'LEGACY_CONTRIBUTION', value: 88 },
    { component: 'longevity', sourceIds: ['season:7:duration'], reasonTag: 'LEGACY_LONGEVITY', value: 91 },
    { component: 'relationship', sourceIds: ['season:7:relationships'], reasonTag: 'LEGACY_RELATIONSHIP', value: 82 },
  ],
  missedOpportunity: { component: 'achievement', sourceIds: [], reasonTag: 'LEGACY_ACHIEVEMENT', value: 70 },
  bestMomentRef: 'season:7:performance',
  percentileHidden: false,
  percentile: 84,
} as unknown as LegacyResult;

describe('LegacyScoreCard', () => {
  it('renders ending, score, band, factors, missed opportunity, best moment, and five-axis details', () => {
    render(<LegacyScoreCard result={result} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('원클럽 레전드');
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('레전드')).toBeInTheDocument();
    expect(screen.getByText('자동 시뮬레이션 참조집단 기준')).toBeInTheDocument();
    expect(screen.getByText('실제 이용자 순위가 아닙니다.')).toBeInTheDocument();
    expect(screen.getByText('참조집단의 84%보다 앞섰다')).toBeInTheDocument();
    expect(screen.getByText('상위 기여 요인')).toBeInTheDocument();
    expect(screen.getByText('아쉬운 기회')).toBeInTheDocument();
    expect(screen.getByText('최고의 순간')).toBeInTheDocument();
    fireEvent.click(screen.getByText('5축 점수 자세히 보기'));
    expect(screen.getByText('성취')).toBeInTheDocument();
    expect(screen.getByText('장기성')).toBeInTheDocument();
  });

  it('only makes source actions buttons when a callback is provided', () => {
    const onSourceClick = vi.fn();
    const { rerender } = render(<LegacyScoreCard result={result} onSourceClick={onSourceClick} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    fireEvent.click(buttons.at(-1)!);
    expect(onSourceClick).toHaveBeenCalledWith(result.bestMomentRef);
    rerender(<LegacyScoreCard result={result} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('omits percentile DOM when percentileHidden is true and does not invent missing sources', () => {
    const hidden = { ...result, percentileHidden: true, percentile: 99 } as unknown as LegacyResult;
    render(<LegacyScoreCard result={hidden} />);
    expect(screen.queryByText(/참조집단의/)).not.toBeInTheDocument();
    expect(screen.queryAllByText('근거 보기')).toHaveLength(3);
  });
});
