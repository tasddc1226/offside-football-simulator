import type { ReactNode } from 'react';
import type { ScreenState } from './screen-state.js';

type Kind<TData, TDraft> = ScreenState<TData, TDraft>['kind'];
type StateOf<TData, TDraft, K extends Kind<TData, TDraft>> = Extract<ScreenState<TData, TDraft>, { kind: K }>;

export interface ScreenStateViewProps<TData, TDraft = never> {
  state: ScreenState<TData, TDraft>;
  loading?: (state: StateOf<TData, TDraft, 'LOADING'>) => ReactNode;
  empty?: (state: StateOf<TData, TDraft, 'EMPTY'>) => ReactNode;
  draft?: (state: StateOf<TData, TDraft, 'DRAFT'>) => ReactNode;
  committing?: (state: StateOf<TData, TDraft, 'COMMITTING'>) => ReactNode;
  resolved?: (state: StateOf<TData, TDraft, 'RESOLVED'>) => ReactNode;
  error?: (state: StateOf<TData, TDraft, 'ERROR'>) => ReactNode;
}

/**
 * 06 "공통 상태"의 상태별 렌더를 고정한다. aria-live 영역은 하나뿐이며
 * LOADING·COMMITTING로 전환될 때의 단계 문구만 낭독한다(다른 전환은 낭독하지 않는다).
 */
export function ScreenStateView<TData, TDraft = never>({
  state,
  loading,
  empty,
  draft,
  committing,
  resolved,
  error,
}: ScreenStateViewProps<TData, TDraft>) {
  const announcement =
    state.kind === 'LOADING'
      ? (state.stage ?? '불러오는 중')
      : state.kind === 'COMMITTING'
        ? '처리 중'
        : '';

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {renderState()}
    </div>
  );

  function renderState(): ReactNode {
    switch (state.kind) {
      case 'LOADING':
        return loading ? loading(state) : null;
      case 'EMPTY':
        return empty ? empty(state) : null;
      case 'DRAFT':
        return draft ? draft(state) : null;
      case 'COMMITTING':
        return committing ? committing(state) : null;
      case 'RESOLVED':
        return resolved ? resolved(state) : null;
      case 'ERROR':
        return error ? error(state) : null;
      default:
        return null;
    }
  }
}
