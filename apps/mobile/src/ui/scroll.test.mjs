import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Keyboard: {}, TextInput: {} }));
import {
  centerView,
  measureShown,
  noteScrollY,
  noteViewH,
  onScrolled,
  registerScroll,
} from './scroll';
import { watchMeasuredShown } from '@offside/app-core/offerVisibility';

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

// 구매 묶음 노출(commerce_stage offer_view)은 IapPacks가 이 측정(measureShown + onScrolled)을 그대로 쓴다.
describe('offer exposure through the real scroll measurement', () => {
  beforeEach(() => {
    registerScroll(null);
    noteViewH(0);
    noteScrollY(0);
  });
  function mount(targetTop) {
    let top = targetTop;
    const viewport = { measureInWindow: (cb) => cb(0, 100, 360, 700) };
    registerScroll({ getNativeScrollRef: () => viewport, scrollTo: vi.fn() });
    noteViewH(600); // 탭바를 뺀 보이는 높이: 100~700
    const target = { measureInWindow: (cb) => cb(0, top, 300, 200) };
    const onShown = vi.fn();
    const w = watchMeasuredShown({
      measure: (cb) => measureShown(target, cb),
      subscribe: onScrolled,
      onShown,
    });
    return { w, onShown, move: (t) => (top = t) };
  }

  it('an expanded card below the fold is not counted until it scrolls ≥50% into view, then once', () => {
    const h = mount(1200); // 선수 탭 아래쪽, 화면 밖
    h.w.check();
    expect(h.onShown).not.toHaveBeenCalled();
    h.move(620); // 80px만 보임(40%)
    noteScrollY(580);
    expect(h.onShown).not.toHaveBeenCalled();
    h.move(500); // 200px 모두 보임
    noteScrollY(700);
    expect(h.onShown).toHaveBeenCalledOnce();
    h.move(300);
    noteScrollY(900);
    expect(h.onShown).toHaveBeenCalledOnce();
  });

  it('no registered scroll view (cannot measure) means no exposure', () => {
    const target = { measureInWindow: (cb) => cb(0, 200, 300, 200) };
    const onShown = vi.fn();
    const w = watchMeasuredShown({
      measure: (cb) => measureShown(target, cb),
      subscribe: onScrolled,
      onShown,
    });
    w.check();
    noteScrollY(10);
    expect(onShown).not.toHaveBeenCalled();
    w.stop();
  });

  it('after unmount (stop) scrolling never counts', () => {
    const h = mount(1200);
    h.w.check();
    h.w.stop();
    h.move(300);
    noteScrollY(900);
    expect(h.onShown).not.toHaveBeenCalled();
  });
});
