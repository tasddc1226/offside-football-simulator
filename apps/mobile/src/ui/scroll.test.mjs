import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Keyboard: {}, TextInput: {} }));
import { centerView, noteScrollY, noteViewH, registerScroll } from './scroll';

describe('centerView', () => {
  beforeEach(() => {
    registerScroll(null);
    noteViewH(0);
    noteScrollY(0);
  });

  it('centers the target within the visible scroll viewport and uses the current offset', () => {
    const scrollTo = vi.fn();
    const viewport = { measureInWindow: (cb) => cb(0, 100, 360, 700) };
    const scroll = { getNativeScrollRef: () => viewport, scrollTo };
    const target = { measureInWindow: (cb) => cb(0, 650, 300, 60) };
    registerScroll(scroll);
    noteViewH(600);
    noteScrollY(200);
    centerView(target, true);
    expect(scrollTo).toHaveBeenCalledWith({ y: 480, animated: true });
  });

  it('clamps the offset at the top and ignores a measurement from a replaced screen', () => {
    const scrollTo = vi.fn();
    let measureTarget;
    const viewport = { measureInWindow: (cb) => cb(0, 100, 360, 600) };
    const scroll = { getNativeScrollRef: () => viewport, scrollTo };
    const target = {
      measureInWindow: (cb) => {
        measureTarget = cb;
      },
    };
    registerScroll(scroll);
    centerView(target);
    measureTarget(0, 110, 300, 50);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    centerView(target);
    registerScroll(null);
    measureTarget(0, 700, 300, 50);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
