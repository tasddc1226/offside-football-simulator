import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useScreenState } from './screen-state.js';

interface Career {
  ovr: number;
}

describe('useScreenState', () => {
  it('COMMITTING 중에는 toDraft 호출을 무시한다(중복 제출 금지)', () => {
    const { result } = renderHook(() =>
      useScreenState<Career, { name: string }>({ kind: 'DRAFT', draft: { name: '' } }),
    );

    act(() => {
      result.current.toCommitting('cmd-1');
    });
    act(() => {
      result.current.toDraft({ name: '바뀐 이름' });
    });

    expect(result.current.state).toEqual({ kind: 'COMMITTING', commandId: 'cmd-1' });
  });

  it('COMMITTING 중에는 toCommitting 재호출도 무시한다', () => {
    const { result } = renderHook(() => useScreenState<Career>({ kind: 'LOADING' }));

    act(() => {
      result.current.toCommitting('cmd-1');
    });
    act(() => {
      result.current.toCommitting('cmd-2');
    });

    expect(result.current.state).toEqual({ kind: 'COMMITTING', commandId: 'cmd-1' });
  });

  it('ERROR는 직전 RESOLVED 데이터를 previous로 보존한다', () => {
    const { result } = renderHook(() => useScreenState<Career>({ kind: 'RESOLVED', data: { ovr: 76 } }));

    act(() => {
      result.current.toCommitting('cmd-2');
    });
    act(() => {
      result.current.toError({ code: 'E_NETWORK', message: '네트워크 오류', retryable: true });
    });

    expect(result.current.state).toEqual({
      kind: 'ERROR',
      code: 'E_NETWORK',
      message: '네트워크 오류',
      retryable: true,
      previous: { ovr: 76 },
    });
  });

  it('RESOLVED 이력이 없으면 ERROR에 previous가 없다', () => {
    const { result } = renderHook(() => useScreenState<Career>({ kind: 'LOADING' }));

    act(() => {
      result.current.toError({ code: 'E_UNKNOWN', message: '알 수 없는 오류', retryable: false });
    });

    expect(result.current.state).toEqual({
      kind: 'ERROR',
      code: 'E_UNKNOWN',
      message: '알 수 없는 오류',
      retryable: false,
    });
  });
});
