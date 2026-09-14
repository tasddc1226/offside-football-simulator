// #231 리뷰 수정: useCommittingExitGuard(active)가 전역 committing-guard 신호를 정확히 켜고 끄는지
// 검증한다 — CareerHeaderBar는 이 신호로 홈 버튼을 비활성화한다(mutating이 이미 끝난 KICKOFF 연출·
// 복구 코드 대기 구간에서도 이탈을 막아야 한다).
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCommittingGuardStore, useIsCommittingGuardActive } from './committing-guard.js';
import { useCommittingExitGuard } from './use-committing-exit-guard.js';

describe('useCommittingExitGuard', () => {
  beforeEach(() => {
    useCommittingGuardStore.setState({ activeCount: 0 });
  });

  it('active가 true인 동안 committing-guard 신호를 켠다', () => {
    const guard = renderHook(({ active }: { active: boolean }) => useCommittingExitGuard(active), {
      initialProps: { active: false },
    });
    const signal = renderHook(() => useIsCommittingGuardActive());
    expect(signal.result.current).toBe(false);

    act(() => {
      guard.rerender({ active: true });
    });
    expect(signal.result.current).toBe(true);

    act(() => {
      guard.rerender({ active: false });
    });
    expect(signal.result.current).toBe(false);
  });

  it('active가 true인 채로 언마운트해도(라우트 전환) 신호를 해제한다', () => {
    const guard = renderHook(() => useCommittingExitGuard(true));
    expect(useCommittingGuardStore.getState().activeCount).toBe(1);

    act(() => {
      guard.unmount();
    });
    expect(useCommittingGuardStore.getState().activeCount).toBe(0);
  });

  it('active가 처음부터 false면 신호를 켜지 않는다', () => {
    renderHook(() => useCommittingExitGuard(false));
    expect(useCommittingGuardStore.getState().activeCount).toBe(0);
  });
});
