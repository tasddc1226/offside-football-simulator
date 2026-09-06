export type CareerClockState = {
  age: number;
  status: string;
  currentStep: number;
  season: { index: number; currentStep: number } | null;
  seasonHistory: readonly unknown[];
  seasonPhase?: string;
  pending?: { kind: string } | null;
};

export type CareerClockView = {
  headline: string;
  detail: string;
  progress: string;
};

/** 실제 저장된 나이와 시즌만 표현한다. 달력 날짜나 생일은 추정하지 않는다. */
export function buildCareerClock(state: CareerClockState): CareerClockView {
  const completed = state.seasonHistory.length;

  if (state.status === 'RETIRED' || state.status === 'ARCHIVED') {
    return {
      headline: `${state.age}세 · 선수 생활 종료`,
      detail: `${completed}시즌 완료`,
      progress: '은퇴 기록',
    };
  }

  if (state.season !== null) {
    return {
      headline: `${state.age}세 · 시즌 ${state.season.index}`,
      detail: `시즌 ${state.season.index}`,
      progress: `${state.season.currentStep}/12 단계`,
    };
  }

  if (state.status === 'DRAFT') {
    return {
      headline: `${state.age}세 · 커리어 준비`,
      detail: '첫 시즌 전',
      progress: state.pending?.kind === 'CONTRACT' || state.pending?.kind === 'OFFERS' ? '첫 계약 선택' : '시즌 준비',
    };
  }

  if (completed === 0) {
    return {
      headline: `${state.age}세 · 커리어 시작`,
      detail: '첫 시즌 전',
      progress:
        state.pending?.kind === 'OFFERS' || state.pending?.kind === 'CONTRACT'
          ? '첫 계약 선택'
          : state.pending?.kind === 'EVENT'
            ? '시작 이야기'
            : '시즌 준비',
    };
  }

  return {
    headline: `${state.age}세 · ${completed}시즌 완료`,
    detail: state.seasonPhase === 'SETTLEMENT' ? '시즌 정산 완료' : '시즌 사이',
    progress: state.pending ? '다음 선택 대기' : '시즌 준비',
  };
}
