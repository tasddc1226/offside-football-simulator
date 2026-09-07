import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenTransition, SCREEN_TRANSITION_MS } from './ScreenTransition.js';

describe('ScreenTransition', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('제목·설명·진행 바·단계 문구를 접근성 속성과 함께 렌더한다', () => {
    vi.useFakeTimers();
    render(
      <ScreenTransition
        title="새 인생을 준비합니다"
        detail="선수 카드를 등록합니다"
        onComplete={() => {}}
        reducedMotion={false}
        stages={['선수 카드 등록 중', '첫 시즌 준비 중', '피치 입장']}
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('새 인생을 준비합니다')).toBeInTheDocument();
    expect(screen.getByText('선수 카드를 등록합니다')).toBeInTheDocument();
    expect(screen.getByText('선수 카드 등록 중')).toBeInTheDocument();
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('waitFor 없이는 3초가 지나야 onComplete를 정확히 한 번 호출한다', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<ScreenTransition title="t" detail="d" onComplete={onComplete} reducedMotion={false} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCREEN_TRANSITION_MS - 1);
    });
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('waitFor가 3초보다 늦게 끝나면 그 완료까지 onComplete를 미룬다', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    let resolveWait: () => void = () => {};
    const waitFor = new Promise<void>((resolve) => {
      resolveWait = resolve;
    });

    render(
      <ScreenTransition
        title="t"
        detail="d"
        onComplete={onComplete}
        reducedMotion={false}
        waitFor={waitFor}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCREEN_TRANSITION_MS);
    });
    // 3초는 지났지만 실제 작업이 아직 안 끝났다 — 아직 완료를 부르지 않는다.
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      resolveWait();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('waitFor가 reject되면 onComplete 대신 onError를 호출하고 이후에도 완료하지 않는다', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const onError = vi.fn();
    let rejectWait: (error: unknown) => void = () => {};
    const waitFor = new Promise<void>((_resolve, reject) => {
      rejectWait = reject;
    });

    render(
      <ScreenTransition
        title="t"
        detail="d"
        onComplete={onComplete}
        onError={onError}
        reducedMotion={false}
        waitFor={waitFor}
      />,
    );

    await act(async () => {
      rejectWait(new Error('실패'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onError).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCREEN_TRANSITION_MS);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('모션 감소는 3초를 기다리지 않고 waitFor 완료 즉시 onComplete를 호출한다', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    let resolveWait: () => void = () => {};
    const waitFor = new Promise<void>((resolve) => {
      resolveWait = resolve;
    });

    render(
      <ScreenTransition
        title="t"
        detail="d"
        onComplete={onComplete}
        reducedMotion
        waitFor={waitFor}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCREEN_TRANSITION_MS);
    });
    // waitFor가 아직 안 끝났으니 모션 감소라도 완료를 부르지 않는다.
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      resolveWait();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('모션 감소이고 waitFor가 없으면 거의 즉시 onComplete를 호출한다', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<ScreenTransition title="t" detail="d" onComplete={onComplete} reducedMotion />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('진행 바가 3초 내내 시간에 따라 값이 커지며 96%를 넘지 않는다', async () => {
    vi.useFakeTimers();
    render(<ScreenTransition title="t" detail="d" onComplete={() => {}} reducedMotion={false} />);

    const progressbar = screen.getByRole('progressbar');
    const readValue = () => Number(progressbar.getAttribute('aria-valuenow'));

    expect(readValue()).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const early = readValue();
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(96);

    // 앞 구간(0.4초)에서 이미 거의 다 차버리던 예전 방식이 아니라, 3초 내내 계속 오르는지
    // 확인한다 — 0.5초 지점보다 1.5초 더 지난 시점 값이 눈에 띄게 더 커야 한다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    const mid = readValue();
    expect(mid).toBeGreaterThan(early);
    expect(mid).toBeLessThan(96);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    const nearEnd = readValue();
    expect(nearEnd).toBeGreaterThan(mid);
    expect(nearEnd).toBeLessThanOrEqual(96);
  });

  it('.os-shell-main 조상이 있으면 그 콘텐츠 높이(clientHeight - 상하 padding)를 인라인 min-height로 설정한다', () => {
    const shellMain = document.createElement('main');
    shellMain.className = 'os-shell-main';
    Object.defineProperty(shellMain, 'clientHeight', { value: 600, configurable: true });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element, ...rest) => {
      if (element === shellMain) {
        return { paddingTop: '16px', paddingBottom: '40px' } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(element, ...rest);
    });
    document.body.appendChild(shellMain);

    const { container } = render(
      <ScreenTransition title="t" detail="d" onComplete={() => {}} reducedMotion />,
      { container: shellMain.appendChild(document.createElement('div')) },
    );

    const overlay = container.querySelector('.os-screen-transition') as HTMLElement;
    expect(overlay).not.toBeNull();
    // 600(clientHeight) - 16(padding-top) - 40(padding-bottom) = 544
    expect(overlay.style.minHeight).toBe('544px');

    document.body.removeChild(shellMain);
    vi.restoreAllMocks();
  });
});
