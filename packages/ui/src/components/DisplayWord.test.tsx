import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DisplayWord } from './DisplayWord.js';

describe('DisplayWord', () => {
  it('renders the word and its caption', () => {
    render(<DisplayWord word="KICKOFF" caption="첫 커리어를 시작할 준비가 됐습니다" />);

    expect(screen.getByText('KICKOFF')).toBeInTheDocument();
    expect(screen.getByText('첫 커리어를 시작할 준비가 됐습니다')).toBeInTheDocument();
  });

  it('requires caption at compile time (DSN-BRD-001)', () => {
    // @ts-expect-error caption은 필수 prop이다.
    const element = <DisplayWord word="KICKOFF" />;
    expect(element).toBeTruthy();
  });
});
