// 잠재력 등급·수치는 은퇴 기록에서만 표시한다. 계산·원본 로그·서버 관측값은 바꾸지 않는다.
// 육성 중에는 시즌 결산에 스카우트 한마디(scoutHint)로 대략적인 수준만 알려 준다.
import { gradeOf, potGrade, potScouted } from '@offside/game/stats';
import type { GameState, LogEntry } from '@offside/game/types';

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

/** 재평가(21·24세)가 모두 끝나기 전에는 3단계로만 알려 준다. 화면 등급이 범위로 흐린 구간과 같다. */
const HINT_EARLY: Record<'high' | 'mid' | 'low', readonly string[]> = {
  high: [
    '또래 중에서는 눈에 띄게 높은 천장을 가졌다는 평가예요.',
    '제대로 크면 큰 무대에서도 통할 재목이라는 말이 나와요.',
    '스카우트 노트에서 이름 옆에 별표가 붙었어요.',
    '지금 성장 속도를 지키면 손꼽히는 재능이 될 거라는 평가예요.',
  ],
  mid: [
    '1부 리그 선수로 충분히 클 수 있다는 평가예요.',
    '어디까지 클지는 앞으로 몇 시즌에 달렸다는 평가예요.',
    '하기에 따라 주전 경쟁도 해 볼 만하다는 평가예요.',
    '확실한 장점을 하나 만들면 크게 달라질 선수라는 평가예요.',
  ],
  low: [
    '재능보다는 꾸준함으로 승부해야 할 선수라는 평가예요.',
    '화려하진 않아도 오래 뛸 수 있는 유형이라는 평가예요.',
    '성실함이 가장 큰 무기가 될 거라는 평가예요.',
    '경기에 꾸준히 나서며 경험을 쌓는 게 중요하다는 평가예요.',
  ],
};
const HINT_LATE: Record<string, readonly string[]> = {
  S: [
    '몇 년에 한 번 나올까 말까 한 재능이라는 평가가 많아요.',
    '세계 최고 무대에서도 이름을 남길 재능이라는 평가예요.',
    '같은 세대에서 가장 높은 천장을 가진 선수로 꼽혀요.',
  ],
  A: [
    '빅리그에서도 통할 재능이라는 평가예요.',
    '리그를 대표하는 선수까지 노려 볼 만하다는 평가예요.',
    '강팀에서 핵심 역할을 맡을 재목이라는 평가예요.',
  ],
  B: [
    '1부 리그 주전까지는 충분히 클 수 있다는 평가예요.',
    '믿고 맡길 수 있는 주전감이라는 평가예요.',
    '팀에 꼭 필요한 선수로 자리 잡을 거라는 평가예요.',
  ],
  C: [
    '하기에 따라 주전 자리도 노려 볼 만하다는 평가예요.',
    '로테이션에서 제 몫을 해 줄 선수라는 평가예요.',
    '기회를 잘 잡으면 한 단계 더 올라설 수 있다는 평가예요.',
  ],
  D: [
    '재능보다는 꾸준함으로 승부할 선수라는 평가예요.',
    '성실함으로 자리를 지키는 유형이라는 평가예요.',
    '오래 뛰며 경험으로 버티는 선수가 될 거라는 평가예요.',
  ],
};
/** 시즌 결산의 스카우트 한마디. 등급 글자 없이 스카우트 평가(potGrade)의 수준만 문장으로 알려 준다.
 * 문장은 선수 이름과 시즌으로 고른다. 게임 RNG를 쓰지 않고, 같은 시즌을 다시 열어도 같은 문장이며 시즌마다 바뀐다. */
export function scoutHint(s: GameState, year: number): string | null {
  if (!potScouted(s)) return null;
  const g = potGrade(s);
  const pool =
    (s.flags.rescout ?? 0) >= 2
      ? HINT_LATE[g]!
      : HINT_EARLY[g === 'S' || g === 'A' ? 'high' : g === 'D' ? 'low' : 'mid'];
  let seed = 0;
  for (const ch of s.name) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  return pool[(seed + year) % pool.length]!;
}
