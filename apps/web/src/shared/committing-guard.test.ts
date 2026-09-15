// #231 리뷰 수정: CareerHeaderBar가 구독하는 전역 committing-guard 신호가 register/release 쌍으로
// 정확히 카운트되는지, 중복 해제·바닥 아래로 내려가지 않는지 검증한다.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  registerCommittingGuard,
  useCommittingGuardStore,
  useIsCommittingGuardActive,
} from './committing-guard.js';

describe('committing-guard', () => {
  beforeEach(() => {
    useCommittingGuardStore.setState({ activeCount: 0 });
  });

  it('등록하면 활성 상태가 되고, 해제하면 다시 비활성으로 돌아간다', () => {
    const { result } = renderHook(() => useIsCommittingGuardActive());
    expect(result.current).toBe(false);

    let release = () => {};
    act(() => {
      release = registerCommittingGuard();
    });
    expect(result.current).toBe(true);

    act(() => {
      release();
    });
    expect(result.current).toBe(false);
  });

  it('같은 해제 함수를 두 번 불러도 카운트가 0 밑으로 내려가지 않는다', () => {
    const release = registerCommittingGuard();
    expect(useCommittingGuardStore.getState().activeCount).toBe(1);

    release();
    release();
    expect(useCommittingGuardStore.getState().activeCount).toBe(0);
  });

  it('여러 화면이 겹쳐 등록해도 각자의 해제가 끝나야 비활성화된다(라우트 전환 중 겹침 대비)', () => {
    const { result } = renderHook(() => useIsCommittingGuardActive());
    let releaseFirst = () => {};
    let releaseSecond = () => {};
    act(() => {
      releaseFirst = registerCommittingGuard();
      releaseSecond = registerCommittingGuard();
    });
    expect(result.current).toBe(true);

    act(() => {
      releaseFirst();
    });
    expect(result.current).toBe(true);

    act(() => {
      releaseSecond();
    });
    expect(result.current).toBe(false);
  });
});
