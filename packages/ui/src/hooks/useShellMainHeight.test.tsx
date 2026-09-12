import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShellMainHeight } from './useShellMainHeight.js';

describe('useShellMainHeight', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
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
    const target = shellMain.appendChild(document.createElement('div'));

    const ref = { current: target };
    renderHook(() => useShellMainHeight(ref));

    // 600(clientHeight) - 16(padding-top) - 40(padding-bottom) = 544
    expect(target.style.minHeight).toBe('544px');
  });

  it('.os-shell-main 조상이 없으면(스토리·단위 테스트 등) 인라인 min-height를 건드리지 않는다', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const ref = { current: target };
    renderHook(() => useShellMainHeight(ref));

    expect(target.style.minHeight).toBe('');
  });

  it('마운트 시점에는 ref.current가 비어 있다가 나중 렌더에서야 채워져도(조건부 렌더링) 그 렌더 이후에는 반영한다', () => {
    // 온보딩처럼 같은 컴포넌트가 먼저 다른 트리(ref 미부착)를 반환했다가, 상태가 바뀐 뒤에야
    // 이 훅이 관찰할 요소를 반환하는 경우를 재현한다 — 마운트 시 한 번만 실행되는 훅이었다면
    // ref.current가 null인 채로 굳어 다시는 동기화하지 않는다.
    const shellMain = document.createElement('main');
    shellMain.className = 'os-shell-main';
    Object.defineProperty(shellMain, 'clientHeight', { value: 600, configurable: true });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element, ...rest) => {
      if (element === shellMain) {
        return { paddingTop: '0px', paddingBottom: '0px' } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(element, ...rest);
    });
    document.body.appendChild(shellMain);
    const target = shellMain.appendChild(document.createElement('div'));

    const ref: { current: HTMLElement | null } = { current: null };
    const { rerender } = renderHook(() => useShellMainHeight(ref));
    expect(target.style.minHeight).toBe('');

    ref.current = target;
    rerender();

    expect(target.style.minHeight).toBe('600px');
  });
});
