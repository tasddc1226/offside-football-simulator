import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameResultReveal } from './game-presentation.js';
import { useUiStore } from './ui-store.js';

afterEach(() => {
  vi.useRealTimers();
  useUiStore.setState({ reducedMotion: 'SYSTEM' });
  delete document.documentElement.dataset.inputModality;
});

describe('GameResultReveal', () => {
  it('shows a saved-result cue until the user skips the reveal', () => {
    vi.useFakeTimers();
    const onSkip = vi.fn();
    render(
      <GameResultReveal announcement="결과 확정" onSkip={onSkip}>
        <p>저장된 결과</p>
      </GameResultReveal>,
    );

    expect(screen.queryByText('저장된 결과')).not.toBeInTheDocument();
    expect(screen.getByText('판정 완료')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '결과 바로 보기' }));
    expect(screen.getByText('저장된 결과')).toBeInTheDocument();
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('gives FAST mode an abbreviated cue before revealing', () => {
    vi.useFakeTimers();
    render(
      <GameResultReveal fast announcement="결과 확정">
        <p>저장된 결과</p>
      </GameResultReveal>,
    );
    expect(screen.queryByText('저장된 결과')).not.toBeInTheDocument();
    act(() => vi.runAllTimers());
    expect(screen.getByText('저장된 결과')).toBeInTheDocument();
  });

  it('skips motion for keyboard input and announces after mount', () => {
    vi.useFakeTimers();
    document.documentElement.dataset.inputModality = 'keyboard';
    render(
      <GameResultReveal announcement="결과 확정" announcementTestId="announcement">
        <p>저장된 결과</p>
      </GameResultReveal>,
    );
    expect(screen.getByText('저장된 결과')).toBeInTheDocument();
    expect(screen.getByTestId('announcement')).toBeEmptyDOMElement();
    act(() => vi.runAllTimers());
    expect(screen.getByTestId('announcement')).toHaveTextContent('결과 확정');
  });
});
