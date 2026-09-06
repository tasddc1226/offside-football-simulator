import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameCompletionTransition, GameResultReveal, useDelayedReveal } from './game-presentation.js';
import { useUiStore } from './ui-store.js';

afterEach(() => {
  vi.useRealTimers();
  useUiStore.setState({ reducedMotion: 'SYSTEM' });
  delete document.documentElement.dataset.inputModality;
});

describe('GameCompletionTransition', () => {
  it('shows saved completion and continues once when skipped', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <GameCompletionTransition title="선수 등록 완료" detail="피치로 이동합니다" onComplete={onComplete} />,
    );

    expect(screen.getByText('선수 등록 완료')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '바로 계속' }));
    act(() => vi.runAllTimers());
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('does not hold keyboard-initiated or reduced-motion navigation', () => {
    vi.useFakeTimers();
    document.documentElement.dataset.inputModality = 'keyboard';
    const onComplete = vi.fn();
    const { unmount } = render(
      <GameCompletionTransition title="킥오프 준비 완료" detail="시즌으로 이동합니다" onComplete={onComplete} />,
    );
    expect(screen.queryByRole('button', { name: '바로 계속' })).not.toBeInTheDocument();
    act(() => vi.runAllTimers());
    expect(onComplete).toHaveBeenCalledOnce();

    unmount();
    delete document.documentElement.dataset.inputModality;
    useUiStore.setState({ reducedMotion: 'ON' });
    const onReducedComplete = vi.fn();
    render(
      <GameCompletionTransition title="등록 완료" detail="다음 화면으로 이동합니다" onComplete={onReducedComplete} />,
    );
    expect(screen.queryByRole('button', { name: '바로 계속' })).not.toBeInTheDocument();
    act(() => vi.runAllTimers());
    expect(onReducedComplete).toHaveBeenCalledOnce();
  });
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

describe('useDelayedReveal (UX-010 P2b 평점 리빌)', () => {
  function Probe({ delayMs }: { delayMs?: number }) {
    const revealed = useDelayedReveal(delayMs);
    return <span data-testid="probe">{revealed ? 'revealed' : 'hidden'}</span>;
  }

  it('지연 시간이 지나야 true가 된다', () => {
    vi.useFakeTimers();
    render(<Probe delayMs={400} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('hidden');
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId('probe')).toHaveTextContent('revealed');
  });

  it('모션 감소·키보드 입력 모드는 지연 없이 즉시 true다', () => {
    useUiStore.setState({ reducedMotion: 'ON' });
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('revealed');
  });
});
