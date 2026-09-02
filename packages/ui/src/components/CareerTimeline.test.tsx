import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CareerTimeline } from './CareerTimeline.js';

const ITEMS = [
  { id: 't1', age: 17, stage: 'YOUTH', title: '커리어 시작' },
  { id: 't2', age: 18, stage: 'PRO', title: '한강 FC 입단', subtitle: '3년 계약' },
];

describe('CareerTimeline', () => {
  it('renders every item with age, stage, title, and optional subtitle', () => {
    render(<CareerTimeline items={ITEMS} emptyMessage="아직 기록이 없습니다" />);

    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('YOUTH')).toBeInTheDocument();
    expect(screen.getByText('커리어 시작')).toBeInTheDocument();
    expect(screen.getByText('한강 FC 입단')).toBeInTheDocument();
    expect(screen.getByText('3년 계약')).toBeInTheDocument();
  });

  it('shows the caller-provided empty message when there are no items', () => {
    render(<CareerTimeline items={[]} emptyMessage="아직 기록이 없습니다" />);
    expect(screen.getByText('아직 기록이 없습니다')).toBeInTheDocument();
  });
});
