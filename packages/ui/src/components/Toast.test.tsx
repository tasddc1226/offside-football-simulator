import { render, screen } from '@testing-library/react';
import type { ToastProps } from './Toast.js';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast.js';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message with role="status"', () => {
    render(<Toast variant="success" message="저장했습니다" onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('저장했습니다');
  });

  it('calls onDismiss automatically after 4 seconds by default', () => {
    const onDismiss = vi.fn();
    render(<Toast variant="error" message="오류가 발생했습니다" onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('still auto-dismisses once even if the caller passes a new onDismiss reference on every render', () => {
    const onDismissCalls: number[] = [];
    let renderCount = 0;

    function Wrapper(props: Omit<ToastProps, 'onDismiss'>) {
      renderCount += 1;
      return <Toast {...props} onDismiss={() => onDismissCalls.push(renderCount)} />;
    }

    const { rerender } = render(<Wrapper variant="success" message="저장했습니다" />);

    // 호출자가 인라인 함수를 넘기는 흔한 패턴을 흉내 낸다: 매번 새 onDismiss 참조로 리렌더.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<Wrapper variant="success" message="저장했습니다" />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<Wrapper variant="success" message="저장했습니다" />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onDismissCalls).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onDismissCalls).toHaveLength(1);
  });

  it('respects a custom durationMs', () => {
    const onDismiss = vi.fn();
    render(<Toast variant="success" message="완료" onDismiss={onDismiss} durationMs={1000} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
