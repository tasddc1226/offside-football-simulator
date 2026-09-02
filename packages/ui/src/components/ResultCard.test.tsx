import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultCard } from './ResultCard.js';

describe('ResultCard', () => {
  it('renders the kind label, title, body, effects, and tags', () => {
    render(
      <ResultCard
        kind="SUCCESS"
        kindLabel="성공"
        title="테스트 통과"
        body="침착하게 대응해 좋은 평가를 받았습니다"
        effects={['결정력 +2']}
        tags={['입단테스트_완료', '테스트_성공']}
      />,
    );

    expect(screen.getByText('성공')).toBeInTheDocument();
    expect(screen.getByText('테스트 통과')).toBeInTheDocument();
    expect(screen.getByText('침착하게 대응해 좋은 평가를 받았습니다')).toBeInTheDocument();
    expect(screen.getByText('결정력 +2')).toBeInTheDocument();
    expect(screen.getByText('입단테스트_완료')).toBeInTheDocument();
    expect(screen.getByText('테스트_성공')).toBeInTheDocument();
  });

  it('omits the effects and tags lists when empty', () => {
    render(<ResultCard kind="FIXED" kindLabel="고정" title="정산" body="이번 시즌이 끝났습니다" effects={[]} tags={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it.each([
    ['SUCCESS', '성공'],
    ['NEUTRAL', '중립'],
    ['FAIL', '실패'],
    ['FIXED', '고정'],
  ] as const)('renders the %s kind with its label', (kind, kindLabel) => {
    render(<ResultCard kind={kind} kindLabel={kindLabel} title="제목" body="본문" effects={[]} tags={[]} />);
    expect(screen.getByText(kindLabel)).toBeInTheDocument();
  });
});
