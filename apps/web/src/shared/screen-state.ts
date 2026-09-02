// 06-ui-ux-specification.md "공통 상태"·"내비게이션".
import { useCallback, useRef, useState } from 'react';

export type ScreenState<TData, TDraft = never> =
  | { kind: 'LOADING'; stage?: string }
  | { kind: 'EMPTY'; reason: string }
  | { kind: 'DRAFT'; draft: TDraft }
  | { kind: 'COMMITTING'; commandId: string }
  | { kind: 'RESOLVED'; data: TData }
  | { kind: 'ERROR'; code: string; message: string; retryable: boolean; previous?: TData };

export interface ScreenStateError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface UseScreenStateResult<TData, TDraft = never> {
  state: ScreenState<TData, TDraft>;
  set: (state: ScreenState<TData, TDraft>) => void;
  toLoading: (stage?: string) => void;
  toEmpty: (reason: string) => void;
  toDraft: (draft: TDraft) => void;
  toCommitting: (commandId: string) => void;
  toResolved: (data: TData) => void;
  toError: (error: ScreenStateError) => void;
}

/**
 * COMMITTING 중에는 중복 제출을 막기 위해 toLoading·toEmpty·toDraft·toCommitting을 무시한다.
 * RESOLVED·ERROR로만 빠져나갈 수 있다. ERROR는 가장 최근 RESOLVED 데이터를 previous로 보존한다
 * (LOADING·COMMITTING을 거쳐도 유지된다).
 */
export function useScreenState<TData, TDraft = never>(
  initial: ScreenState<TData, TDraft>,
): UseScreenStateResult<TData, TDraft> {
  const [state, setState] = useState<ScreenState<TData, TDraft>>(initial);
  const lastResolvedRef = useRef<TData | undefined>(initial.kind === 'RESOLVED' ? initial.data : undefined);

  const set = useCallback((next: ScreenState<TData, TDraft>) => {
    if (next.kind === 'RESOLVED') {
      lastResolvedRef.current = next.data;
    }
    setState(next);
  }, []);

  const toLoading = useCallback((stage?: string) => {
    setState((current) => {
      if (current.kind === 'COMMITTING') return current;
      return stage === undefined ? { kind: 'LOADING' } : { kind: 'LOADING', stage };
    });
  }, []);

  const toEmpty = useCallback((reason: string) => {
    setState((current) => (current.kind === 'COMMITTING' ? current : { kind: 'EMPTY', reason }));
  }, []);

  const toDraft = useCallback((draft: TDraft) => {
    setState((current) => (current.kind === 'COMMITTING' ? current : { kind: 'DRAFT', draft }));
  }, []);

  const toCommitting = useCallback((commandId: string) => {
    setState((current) =>
      current.kind === 'COMMITTING' ? current : { kind: 'COMMITTING', commandId },
    );
  }, []);

  const toResolved = useCallback((data: TData) => {
    lastResolvedRef.current = data;
    setState({ kind: 'RESOLVED', data });
  }, []);

  const toError = useCallback((error: ScreenStateError) => {
    const previous = lastResolvedRef.current;
    setState(previous === undefined ? { kind: 'ERROR', ...error } : { kind: 'ERROR', ...error, previous });
  }, []);

  return { state, set, toLoading, toEmpty, toDraft, toCommitting, toResolved, toError };
}
