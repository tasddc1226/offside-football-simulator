import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SwipeSurface, type SwipeSurfaceProps } from './SwipeSurface.js';

let eventTime = 0;
let nextFrame = 0;
let frames: Map<number, FrameRequestCallback>;

function pointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture',
  x: number,
  y = 40,
  overrides: Partial<PointerEvent> = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  eventTime += 50;
  Object.defineProperties(
    event,
    Object.fromEntries(
      Object.entries({
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        timeStamp: eventTime,
        ...overrides,
      }).map(([key, value]) => [key, { value }]),
    ),
  );
  fireEvent(element, event);
}

function setup(props: Partial<SwipeSurfaceProps> = {}) {
  const onSwipe = vi.fn();
  const result = render(
    <SwipeSurface canSwipeRight onSwipe={onSwipe} {...props}>
      {props.children ?? <p>커리어 요약</p>}
    </SwipeSurface>,
  );
  const surface = result.container.querySelector<HTMLElement>('[data-swipe-surface]')!;
  const content = surface.querySelector<HTMLElement>('.os-swipe-content')!;
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 360 } as DOMRect);
  return { ...result, surface, content, onSwipe };
}

function swipe(element: Element, from = 20, to = 160) {
  pointer(element, 'pointerdown', from);
  pointer(element, 'pointermove', to);
  pointer(element, 'pointerup', to);
}

beforeEach(() => {
  eventTime = 0;
  nextFrame = 0;
  frames = new Map();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SwipeSurface', () => {
  it('tracks touch 1:1 and calls the allowed navigation exactly once on release', () => {
    const { surface, content, onSwipe } = setup();
    const text = screen.getByText('커리어 요약');
    pointer(text, 'pointerdown', 20);
    pointer(text, 'pointermove', 160);
    expect(content.style.transform).toBe('translateX(140px)');
    expect(surface).toHaveAttribute('data-dragging', 'true');
    expect(onSwipe).not.toHaveBeenCalled();
    pointer(text, 'pointerup', 160);
    pointer(text, 'pointerup', 160);
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('right');
    expect(content.style.transform).toBe('');
    expect(content.style.willChange).toBe('');
  });

  it('supports left swipes when explicitly enabled', () => {
    const { surface, onSwipe } = setup({ canSwipeLeft: true, canSwipeRight: false });
    swipe(surface, 250, 80);
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('left');
  });

  it('keeps dragging when native implicit capture transfers from a child to the surface', () => {
    const { surface, onSwipe } = setup();
    const text = screen.getByText('커리어 요약');
    pointer(text, 'pointerdown', 20);
    pointer(text, 'pointermove', 50);
    pointer(text, 'lostpointercapture', 50);
    expect(surface).toHaveAttribute('data-dragging', 'true');
    pointer(surface, 'pointermove', 170);
    pointer(surface, 'pointerup', 170);
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('right');
  });

  it('cancels when the surface itself loses capture', () => {
    const { surface, onSwipe } = setup();
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 170);
    pointer(surface, 'lostpointercapture', 170);
    pointer(surface, 'pointerup', 170);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('does not act on taps, disallowed directions, or vertical scrolling', () => {
    const { surface, onSwipe } = setup();
    swipe(surface, 20, 25);
    swipe(surface, 220, 30);
    pointer(surface, 'pointerdown', 20, 40);
    pointer(surface, 'pointermove', 25, 120);
    pointer(surface, 'pointermove', 180, 120);
    pointer(surface, 'pointerup', 180, 120);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('springs a partial gesture back and permits grabbing the current position', () => {
    const { surface, content, onSwipe } = setup();
    swipe(surface, 20, 45);
    expect(onSwipe).not.toHaveBeenCalled();
    expect(content.style.transform).toBe('translateX(25px)');
    expect(frames.size).toBe(1);
    pointer(surface, 'pointerdown', 20);
    expect(frames.size).toBe(0);
    pointer(surface, 'pointermove', 35);
    expect(content.style.transform).toBe('translateX(40px)');
    pointer(surface, 'pointercancel', 35);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('limits an edge gesture to the first 28 px of its surface', () => {
    const { surface, onSwipe } = setup({ edgeOnly: true });
    swipe(surface, 80, 250);
    expect(onSwipe).not.toHaveBeenCalled();
    swipe(surface, 28, 170);
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('right');
  });

  it('does not turn mouse drags into navigation', () => {
    const { surface, onSwipe } = setup();
    pointer(surface, 'pointerdown', 20, 40, { pointerType: 'mouse' });
    pointer(surface, 'pointermove', 160, 40, { pointerType: 'mouse' });
    pointer(surface, 'pointerup', 160, 40, { pointerType: 'mouse' });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('cancels for a second touch and for pointer cancellation', () => {
    const { surface, onSwipe } = setup();
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    pointer(surface, 'pointerdown', 70, 60, { pointerId: 2, isPrimary: false });
    pointer(surface, 'pointerup', 160);
    pointer(surface, 'pointerup', 190, 60, { pointerId: 2, isPrimary: false });
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    pointer(surface, 'pointercancel', 160);
    pointer(surface, 'pointerup', 160);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it.each([
    <button type="button" key="button">
      조작
    </button>,
    <a href="/settings" key="link">
      조작
    </a>,
    <form key="form">
      <p>조작</p>
    </form>,
    <div key="editable" contentEditable suppressContentEditableWarning>
      조작
    </div>,
    <div key="tab" role="tab" tabIndex={0}>
      조작
    </div>,
  ])('ignores interactive and editable content %#', (children) => {
    const { onSwipe } = setup({ children });
    swipe(screen.getByText('조작'));
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('ignores horizontal scrollers and selected text', () => {
    const { onSwipe } = setup({
      children: (
        <div style={{ overflowX: 'auto' }}>
          <p>기록</p>
        </div>
      ),
    });
    const text = screen.getByText('기록');
    Object.defineProperties(text.parentElement, {
      scrollWidth: { value: 600 },
      clientWidth: { value: 300 },
    });
    swipe(text);
    expect(onSwipe).not.toHaveBeenCalled();
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => '선택된 글자',
    } as Selection);
    swipe(text.closest('[data-swipe-surface]')!);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('does not navigate behind an open dialog', () => {
    const { surface, onSwipe } = setup({
      children: (
        <div role="dialog" data-state="open">
          팝업
        </div>
      ),
    });
    swipe(surface);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('does not interrupt an actively edited input even when touching elsewhere', () => {
    const { surface, onSwipe } = setup({ children: <input aria-label="이름" /> });
    screen.getByRole('textbox', { name: '이름' }).focus();
    swipe(surface);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('cancels a live gesture when the window loses focus', () => {
    const { surface, content, onSwipe } = setup();
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    fireEvent(window, new Event('blur'));
    expect(content.style.transform).toBe('');
    pointer(surface, 'pointerup', 160);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('keeps the gesture available without spatial motion when reduced motion is enabled', () => {
    const { surface, content, onSwipe } = setup({ reducedMotion: true });
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    expect(content.style.transform).toBe('');
    pointer(surface, 'pointerup', 160);
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('right');
    expect(frames.size).toBe(0);
  });

  it('honors the operating system reduced-motion setting too', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { surface, content, onSwipe } = setup();
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    expect(content.style.transform).toBe('');
    pointer(surface, 'pointerup', 160);
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('right');
    expect(frames.size).toBe(0);
  });

  it('cancels a gesture immediately when the operating system motion preference changes', () => {
    let preferenceChanged: (() => void) | undefined;
    const preference = {
      matches: false,
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        preferenceChanged = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => preference),
    );
    const { surface, content, onSwipe } = setup();
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    preference.matches = true;
    preferenceChanged?.();
    expect(content.style.transform).toBe('');
    pointer(surface, 'pointerup', 160);
    expect(onSwipe).not.toHaveBeenCalled();
    swipe(surface);
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('right');
    expect(frames.size).toBe(0);
  });

  it('uses the latest callback without interrupting a live gesture', () => {
    const { surface, onSwipe, rerender } = setup();
    const latestSwipe = vi.fn();
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    rerender(
      <SwipeSurface canSwipeRight onSwipe={latestSwipe}>
        커리어 요약
      </SwipeSurface>,
    );
    pointer(surface, 'pointerup', 160);
    expect(latestSwipe).toHaveBeenCalledExactlyOnceWith('right');
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('cleans up a live gesture when disabled and leaves all directions off by default', () => {
    const { surface, content, onSwipe, rerender } = setup();
    pointer(surface, 'pointerdown', 20);
    pointer(surface, 'pointermove', 160);
    rerender(
      <SwipeSurface onSwipe={onSwipe} canSwipeRight disabled>
        저장 중
      </SwipeSurface>,
    );
    expect(content.style.transform).toBe('');
    expect(surface).toHaveAttribute('data-swipe-enabled', 'false');
    pointer(surface, 'pointerup', 160);
    expect(onSwipe).not.toHaveBeenCalled();
    rerender(<SwipeSurface onSwipe={onSwipe}>기본 화면</SwipeSurface>);
    swipe(surface);
    expect(surface).toHaveAttribute('data-swipe-enabled', 'false');
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('suppresses only the synthetic swipe click, not a later tap or keyboard activation', () => {
    const onClick = vi.fn();
    setup({ children: <div onClick={onClick}>내용</div> });
    const text = screen.getByText('내용');
    swipe(text);
    fireEvent.click(text, { detail: 1 });
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(text, { detail: 0 });
    expect(onClick).toHaveBeenCalledTimes(1);
    swipe(text, 20, 22);
    fireEvent.click(text, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('lets only the innermost surface handle a gesture', () => {
    const innerSwipe = vi.fn();
    const { onSwipe } = setup({
      children: (
        <SwipeSurface canSwipeLeft onSwipe={innerSwipe}>
          <p>기록 탭</p>
        </SwipeSurface>
      ),
    });
    swipe(screen.getByText('기록 탭'), 220, 20);
    expect(innerSwipe).toHaveBeenCalledExactlyOnceWith('left');
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('cancels scheduled spring frames on unmount', () => {
    const { surface, unmount } = setup();
    swipe(surface, 20, 45);
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});
