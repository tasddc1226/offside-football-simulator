// 잠재력 등급·수치는 은퇴 기록에서만 표시한다. 계산·원본 로그·서버 관측값은 바꾸지 않는다.
// 육성 중에는 시즌 결산에 스카우트 한마디(scoutHint)로 대략적인 수준만 알려 준다.
import { hashStr } from '@offside/game/hash';
import { gradeOf, potFogged, potGrade, potScouted } from '@offside/game/stats';
import type { GameState, LogEntry } from '@offside/game/types';
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
  /^스카우트 재평가(?:[: ·]|$)/.test(text);
export const visibleSeasonNotes = (notes: readonly string[]): string[] =>
  notes.filter((text) => !isPotentialReassessment(text));
export const visibleCareerLog = (entries: readonly LogEntry[]): LogEntry[] =>
  entries.filter((entry) => !isPotentialReassessment(entry.text));

/** 재평가(21·24세)가 모두 끝나기 전에는 3단계로만 알려 준다. 화면 등급이 범위로 흐린 구간과 같다. */
const HINT_EARLY: Record<'high' | 'mid' | 'low', readonly string[]> = {
  high: [
    '이 녀석, 물건이군. 제대로만 크면 큰 무대에서도 통하겠군.',
    '또래 중에선 성장 가능성이 가장 높아 보이는군.',
    '리포트에 별표를 쳐 둬야겠군. 이런 선수는 흔치 않군.',
    '이 속도라면 몇 년 안에 이름을 날리겠군.',
  ],
  mid: [
    '1부 리그 선수까진 충분히 크겠군. 그다음은 본인 하기 나름이겠군.',
    '아직 판단하긴 이르군. 앞으로 두세 시즌이 관건이겠군.',
    '주전 경쟁도 해 볼 만하겠군. 무기 하나만 확실히 만든다면.',
    '튀는 건 없지만 기본기가 괜찮군. 잘 다듬으면 쓸 만하겠군.',
  ],
  low: [
    '재능으로 승부할 타입은 아니군. 대신 꾸준하면 길게 가겠군.',
    '화려하진 않군. 하지만 이런 선수가 오래 뛰겠군.',
    '성실함 하나는 확실하군. 그게 이 친구의 무기겠군.',
    '지금은 경기를 많이 뛰며 경험을 쌓는 게 먼저겠군.',
  ],
};
const HINT_LATE: Record<string, readonly string[]> = {
  S: [
    '몇 년에 한 번 나올까 말까 한 재능이군. 내 경력에서도 손에 꼽겠군.',
    '이 친구는 세계 최고 무대에 서야 할 선수로군.',
    '같은 세대에서 이만한 성장 가능성은 처음 보는군.',
  ],
  A: [
    '빅리그에서도 충분히 통하겠군.',
    '리그를 대표하는 선수까지 노려 볼 만하겠군.',
    '강팀에 가도 핵심 역할을 맡을 재목이군.',
  ],
  B: [
    '1부 리그 주전감이군. 그건 틀림없겠군.',
    '감독이라면 믿고 내보낼 수 있는 선수로군.',
    '어느 팀에 가도 제자리는 찾겠군.',
  ],
  C: [
    '하기에 따라 주전 자리도 노려 볼 만하겠군.',
    '로테이션에서 제 몫은 해 주겠군.',
    '기회만 잘 잡으면 한 단계 더 올라서겠군.',
  ],
  D: [
    '재능보다는 꾸준함으로 승부할 선수로군.',
    '성실함으로 자리를 지키는 유형이군. 그것도 재능이군.',
    '경험으로 버티는 선수가 되겠군. 오래 뛰겠군.',
  ],
};
/** 시즌 결산의 스카우트 한마디(스카우트가 직접 하는 말). 등급 글자 없이 스카우트 평가(potGrade)의 수준만 문장으로 알려 준다.
 * 문장은 선수 이름과 시즌으로 고른다. 게임 RNG를 쓰지 않고, 같은 시즌을 다시 열어도 같은 문장이며 시즌마다 바뀐다. */
export function scoutHint(s: GameState, year: number): string | null {
  if (!potScouted(s)) return null;
  const g = potGrade(s);
  const pool = potFogged(s)
    ? HINT_EARLY[g === 'S' || g === 'A' ? 'high' : g === 'D' ? 'low' : 'mid']
    : HINT_LATE[g]!;
  // 이름으로 시작 문장을 정하고 시즌마다 다음 문장으로 넘긴다. 연속한 두 시즌은 같은 문장이 나오지 않는다.
  return pool[(hashStr(s.name) + year) % pool.length]!;
}
