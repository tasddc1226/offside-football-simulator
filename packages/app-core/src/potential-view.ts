// 잠재력은 은퇴 기록에서만 표시한다. 계산·원본 로그·서버 관측값은 바꾸지 않는다.
import { gradeOf } from '@offside/game/stats';
import type { LogEntry } from '@offside/game/types';

export const POTENTIAL_NOTICE = '잠재력 평가는 은퇴할 때 공개돼요.';
export const RETIREMENT_POTENTIAL_NOTE =
  '은퇴 시점의 성장 기준값이에요. 고정된 최대 OVR은 아니며, 최고 OVR이 이 값을 넘을 수 있어요.';

/** 이미 저장된 은퇴 수치(반올림한 truePot)만 사용한다. 없는 과거 값은 추정하지 않는다. */
export function retirementPotential(value: number | null | undefined) {
  if (value == null || !Number.isInteger(value) || value < 0 || value > 150) return undefined;
  return { real: gradeOf(value), value };
}

/** 옛 세이브·복원된 결산에도 적용한다. 원본은 수정하지 않아 엔진 결과와 저장 의미를 보존한다. */
export const isPotentialReassessment = (text: string): boolean =>
  /^스카우트 재평가(?:[: ·]|$)/.test(text);
export const visibleSeasonNotes = (notes: readonly string[]): string[] =>
  notes.filter((text) => !isPotentialReassessment(text));
export const visibleCareerLog = (entries: readonly LogEntry[]): LogEntry[] =>
  entries.filter((entry) => !isPotentialReassessment(entry.text));
