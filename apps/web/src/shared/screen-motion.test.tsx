import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MotionPanel,
  playScreenMotion,
  screenDirection,
  swipeBackTarget,
  useInputModality,
} from './screen-motion.js';
import { useUiStore } from './ui-store.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.inputModality;
  useUiStore.setState({ reducedMotion: 'SYSTEM' });
});

describe('navigation motion policy', () => {
  it.each([
    ['BACK', undefined, 'back'],
    ['GO', -1, 'back'],
    ['FORWARD', undefined, 'forward'],
    ['GO', 1, 'forward'],
    ['REPLACE', undefined, 'replace'],
    ['PUSH', undefined, 'forward'],
  ] as const)('uses public %s history direction', (type, index, expected) => {
    expect(
      screenDirection('/onboarding', '/settings', {
        type,
        ...(index === undefined ? {} : { index }),
      }),
    ).toBe(expected);
  });

  it('recognizes explicit parent and creation previous buttons as backward navigation', () => {
    expect(screenDirection('/legal/privacy', '/settings', { type: 'PUSH' })).toBe('back');
    expect(screenDirection('/settings', '/', { type: 'PUSH' })).toBe('back');
    expect(screenDirection('/career/one/attributes', '/career/one', { type: 'PUSH' })).toBe('back');
    expect(screenDirection('/career/one/confirm', '/career/one/style', { type: 'PUSH' })).toBe(
      'back',
    );
    expect(screenDirection('/career/one/style', '/career/one/confirm', { type: 'PUSH' })).toBe(
      'forward',
    );
  });

  it('only allows explicit read-only back destinations', () => {
    expect(swipeBackTarget('/legal/terms')).toBe('/settings');
    expect(swipeBackTarget('/legal/privacy')).toBe('/settings');
    expect(swipeBackTarget('/career/one/attributes')).toBe('/career/one');
    for (const path of [
      '/',
      '/settings',
      '/onboarding',
      '/career/one',
      '/career/one/create',
      '/career/one/style',
      '/career/one/confirm',
      '/career/one/event',
      '/career/one/contract',
      '/career/one/season-prep',
      '/career/one/season-result',
      '/career/one/chapter',
    ]) {
      expect(swipeBackTarget(path)).toBeNull();
    }
  });
});

describe('screen animation', () => {
  function elementWithAnimation() {
    const element = document.createElement('div');
    const animation = { cancel: vi.fn(), id: '' } as unknown as Animation;
    element.animate = vi.fn(() => animation);
    return { element, animation };
  }

  it('uses short mirrored transform/opacity motion without fill styles', () => {
    const { element, animation } = elementWithAnimation();
    expect(playScreenMotion(element, 'back', false)).toBe(animation);
    expect(animation.id).toBe('offside-screen-transition');
    expect(element.animate).toHaveBeenCalledWith(
      [
        { transform: 'translate3d(-24px, 0, 0)', opacity: 1 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
      ],
      { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  });

  it('skips app reduction, OS reduction, keyboard input and unsupported animation APIs', () => {
    const { element } = elementWithAnimation();
    expect(playScreenMotion(element, 'forward', true)).toBeNull();
    document.documentElement.dataset.inputModality = 'keyboard';
    expect(playScreenMotion(element, 'forward', false)).toBeNull();
    delete document.documentElement.dataset.inputModality;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    expect(playScreenMotion(element, 'forward', false)).toBeNull();
    expect(element.animate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    expect(playScreenMotion(document.createElement('div'), 'forward', false)).toBeNull();
  });

  it('does not remount child state and cancels in-flight animation on the next transition/unmount', () => {
    const animations: { cancel: ReturnType<typeof vi.fn>; id: string }[] = [];
    vi.stubGlobal('Animation', class {});
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => {
        const animation = { cancel: vi.fn(), id: '' };
        animations.push(animation);
        return animation;
      }),
    });
    const view = render(
      <MotionPanel motionKey="a">
        <input defaultValue="보존할 이름" />
      </MotionPanel>,
    );
    const input = view.container.querySelector('input');
    expect(animations).toHaveLength(0);
    view.rerender(
      <MotionPanel motionKey="b">
        <input defaultValue="보존할 이름" />
      </MotionPanel>,
    );
    expect(view.container.querySelector('input')).toBe(input);
    expect(animations).toHaveLength(1);
    view.rerender(
      <MotionPanel motionKey="c">
        <input defaultValue="보존할 이름" />
      </MotionPanel>,
    );
    expect(animations[0]!.cancel).toHaveBeenCalled();
    view.unmount();
    expect(animations[1]!.cancel).toHaveBeenCalled();
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it('tracks keyboard and pointer modality at the document root for portal dialogs too', () => {
    function InputTracker() {
      useInputModality();
      return null;
    }
    const view = render(<InputTracker />);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.documentElement.dataset.inputModality).toBe('keyboard');
    fireEvent.pointerDown(document);
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
    view.unmount();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });
});
