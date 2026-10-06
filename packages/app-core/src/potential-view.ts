// 잠재력 등급·수치는 은퇴 기록에서만 표시한다. 계산·원본 로그·서버 관측값은 바꾸지 않는다.
// 육성 중에는 시즌 결산에 스카우트 한마디(scoutHint.ts)로 대략적인 수준만 알려 준다.
import { gradeOf } from '@offside/game/stats';
import type { LogEntry } from '@offside/game/types';
import { gamePotentialNoteText } from './i18n/ko/gamePotentialNote';

/** 안내 문구 — 언어가 정해진 뒤에 읽도록 함수로 둔다(모듈 최상위 상수는 영어가 안 나온다). */
export const potentialNotice = (): string => gamePotentialNoteText.notice;
export const retirementPotentialNote = (): string => gamePotentialNoteText.retirementNote;

/** 이미 저장된 은퇴 수치(반올림한 truePot)만 사용한다. 없는 과거 값은 추정하지 않는다. */
export function retirementPotential(value: number | null | undefined) {
  if (value == null || !Number.isInteger(value) || value < 0 || value > 150) return undefined;
  return { real: gradeOf(value), value };
}

/** 옛 세이브·복원된 결산에도 적용한다. 원본은 수정하지 않아 엔진 결과와 저장 의미를 보존한다. */
export const isPotentialReassessment = (text: string): boolean =>
  /^(?:스카우트 재평가|Scout reassessment)(?:[: ·]|$)/.test(text);
export const visibleSeasonNotes = (notes: readonly string[]): string[] =>
  notes.filter((text) => !isPotentialReassessment(text));
export const visibleCareerLog = (entries: readonly LogEntry[]): LogEntry[] =>
  entries.filter((entry) => !isPotentialReassessment(entry.text));
