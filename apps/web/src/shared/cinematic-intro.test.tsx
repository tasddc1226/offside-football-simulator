import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CinematicIntro } from './cinematic-intro.js';
import { useUiStore } from './ui-store.js';

afterEach(() => {
  vi.useRealTimers();
  useUiStore.setState({ reducedMotion: 'SYSTEM' });
});

describe('CinematicIntro', () => {
  it('탭하면(전체 화면 버튼) 즉시 onComplete를 한 번 호출한다', () => {
    const onComplete = vi.fn();
    render(<CinematicIntro onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: '탭하여 스킵' }));
    expect(onComplete).toHaveBeenCalledOnce();

    // 중복 클릭이 onComplete를 다시 부르지 않는다(GameCompletionTransition과 같은 가드).
    fireEvent.click(screen.getByRole('button', { name: '탭하여 스킵' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('모션 감소 설정이면 타자기 없이 정적으로 두고 자동으로 onComplete를 호출한다', () => {
    vi.useFakeTimers();
    useUiStore.setState({ reducedMotion: 'ON' });
    const onComplete = vi.fn();
    render(<CinematicIntro onComplete={onComplete} />);

    act(() => vi.runAllTimers());
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
