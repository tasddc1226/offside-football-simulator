// 잠재력 등급·수치는 은퇴 기록에서만 표시한다. 계산·원본 로그·서버 관측값은 바꾸지 않는다.
// 육성 중에는 시즌 결산에 스카우트 한마디(scoutHint.ts)로 대략적인 수준만 알려 준다.
import { gradeOf, truePot } from '@offside/game/stats';
import type { GameState, HofEntry, LogEntry } from '@offside/game/types';
import { gamePotentialNoteText } from './i18n/ko/gamePotentialNote';

/** 안내 문구 — 언어가 정해진 뒤에 읽도록 함수로 둔다(모듈 최상위 상수는 영어가 안 나온다). */
export const potentialNotice = (): string => gamePotentialNoteText.notice;
export const retirementPotentialNote = (): string => gamePotentialNoteText.retirementNote;

/** 이미 저장된 은퇴 수치(반올림한 truePot)만 사용한다. 없는 과거 값은 추정하지 않는다. */
export function retirementPotential(value: number | null | undefined) {
  if (value == null || !Number.isInteger(value) || value < 0 || value > 150) return undefined;
  return { real: gradeOf(value), value };
}

/** T-11-141 은퇴 리포트의 '잠재력이 바뀐 과정'. 시작 값(origin)이 없는 옛 세이브는 강화·마지막 값만 있다. */
export interface PotentialFlow {
  start?: { grade: string; value: number };
  /** 성장기(25세까지) 실제 잠재력이 오르내린 합. */
  drift?: number;
  /** 잠재력 강화로 오른 값. */
  boost: number;
  seed?: number;
  /** 마지막 시즌에 적용된 밸런스 버전(0 = 기본값). */
  bal: number;
}

function flowOf(pot: number, f: NonNullable<HofEntry['potFlow']>): PotentialFlow {
  const o = f.origin;
  return {
    ...(o && {
      start: { grade: gradeOf(o.pot), value: o.pot },
      drift: pot - f.boost - o.pot,
      seed: o.seed,
    }),
    boost: f.boost,
    bal: f.bal,
  };
}

/** 방금 은퇴한 세이브에서. */
export function potentialFlow(s: GameState): PotentialFlow | undefined {
  if (!s.retired) return undefined;
  return flowOf(Math.round(truePot(s)), {
    ...(s.origin && { origin: s.origin }),
    boost: s.flags.potBonus ?? 0,
    bal: s.bal?.v ?? 0,
  });
}

/** 기록실의 은퇴 기록에서(세이브를 지운 뒤에도 같은 흐름). */
export const hofPotentialFlow = (h: HofEntry): PotentialFlow | undefined =>
  h.pot !== undefined && h.potFlow ? flowOf(h.pot, h.potFlow) : undefined;

/** 옛 세이브·복원된 결산에도 적용한다. 원본은 수정하지 않아 엔진 결과와 저장 의미를 보존한다. */
export const isPotentialReassessment = (text: string): boolean =>
  /^(?:스카우트 재평가|Scout reassessment)(?:[: ·]|$)/.test(text);
export const visibleSeasonNotes = (notes: readonly string[]): string[] =>
  notes.filter((text) => !isPotentialReassessment(text));
export const visibleCareerLog = (entries: readonly LogEntry[]): LogEntry[] =>
  entries.filter((entry) => !isPotentialReassessment(entry.text));
