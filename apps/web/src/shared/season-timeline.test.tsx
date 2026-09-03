// SCR-029 SeasonTimeline: 지난/진행 중/예정 step 구분과 결정 슬롯 표식(예산 절단 취소선 포함)을
// aria-label·시각 표식으로 확인한다(단위 테스트).
import { render, screen } from '@testing-library/react';
import type { SeasonStep } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { SeasonTimeline } from './season-timeline.js';

function step(overrides: Partial<SeasonStep> & { index: number }): SeasonStep {
  return {
    phase: 'LEAGUE',
    windowOpen: true,
    decisionSlots: [],
    summary: null,
    ...overrides,
  };
}

describe('SeasonTimeline', () => {
  it('summary가 있는 step은 "지난 step"으로, currentStep과 같은 step은 "진행 중"으로, 그 외는 "예정"으로 표시한다', () => {
    const steps: SeasonStep[] = [
      step({ index: 1, summary: { passedAtRevision: 5, decisionsOpened: 0, matchesPlayed: 1, results: [] } }),
      step({ index: 2 }),
      step({ index: 3 }),
    ];

    render(<SeasonTimeline steps={steps} currentStep={2} />);

    expect(screen.getByLabelText('step 1 리그 지난 step')).toBeInTheDocument();
    expect(screen.getByLabelText('step 2 리그 진행 중')).toBeInTheDocument();
    expect(screen.getByLabelText('step 3 리그 예정')).toBeInTheDocument();
  });

  it('결정 슬롯을 종류 라벨로 보여주고, RULE-TIME-004로 잘린 슬롯은 취소선(opacity-40 line-through) 클래스를 붙인다', () => {
    const steps: SeasonStep[] = [
      step({
        index: 4,
        decisionSlots: [
          { kind: 'CHAPTER', required: true, importance: 'MAJOR' },
          { kind: 'EVENT', required: false, skippedByBudget: true },
        ],
      }),
    ];

    render(<SeasonTimeline steps={steps} currentStep={1} />);

    expect(screen.getByText('핵심 경기')).toBeInTheDocument();
    const skipped = screen.getByText('이벤트');
    expect(skipped.className).toContain('line-through');
  });

  it('시즌 12 step 전부를 순서대로 렌더링한다', () => {
    const steps: SeasonStep[] = Array.from({ length: 12 }, (_, i) => step({ index: i + 1 }));

    render(<SeasonTimeline steps={steps} currentStep={1} />);

    const list = screen.getByLabelText('시즌 진행 12 step');
    expect(list.querySelectorAll('li')).toHaveLength(12);
  });
});
