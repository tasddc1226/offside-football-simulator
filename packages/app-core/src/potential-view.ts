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
    '이 녀석, 물건입니다. 제대로만 크면 큰 무대에서도 통할 겁니다.',
    '또래 중에선 천장이 제일 높아 보여요. 계속 지켜볼 생각입니다.',
    '리포트에 별표 쳐 뒀습니다. 이런 선수 흔치 않아요.',
    '지금 속도만 유지하면 몇 년 안에 이름 날릴 겁니다.',
  ],
  mid: [
    '1부 리그 선수까진 충분히 클 겁니다. 그다음은 본인 하기 나름이고요.',
    '아직 판단하긴 이릅니다. 앞으로 두세 시즌이 관건이에요.',
    '주전 경쟁, 해 볼 만합니다. 무기 하나만 확실히 만들면요.',
    '확 튀는 건 없는데 기본기가 괜찮아요. 잘 다듬으면 쓸 만합니다.',
  ],
  low: [
    '재능으로 승부할 타입은 아닙니다. 대신 꾸준하면 길게 갑니다.',
    '화려하진 않아요. 근데 이런 선수가 오래 뜁니다.',
    '성실함 하나는 확실합니다. 그게 이 친구 무기예요.',
    '지금은 경기 많이 뛰면서 경험 쌓는 게 먼저입니다.',
  ],
};
const HINT_LATE: Record<string, readonly string[]> = {
  S: [
    '몇 년에 한 번 나올까 말까 한 재능입니다. 제 경력에서도 손에 꼽아요.',
    '이 친구는 세계 최고 무대에 서야 할 선수입니다.',
    '같은 세대에서 이만한 천장은 못 봤습니다.',
  ],
  A: [
    '빅리그에서도 충분히 통합니다. 제가 장담하죠.',
    '리그를 대표하는 선수까지 노려 볼 만합니다.',
    '강팀에 가도 핵심 역할 맡을 재목입니다.',
  ],
  B: [
    '1부 리그 주전감입니다. 그건 확실해요.',
    '감독 입장에선 믿고 내보낼 수 있는 선수죠.',
    '어느 팀에 가도 제자리는 찾을 겁니다.',
  ],
  C: [
    '하기에 따라 주전 자리도 노려 볼 만합니다.',
    '로테이션에서 제 몫은 해 줄 선수예요.',
    '기회만 잘 잡으면 한 단계 더 올라설 수 있습니다.',
  ],
  D: [
    '재능보다는 꾸준함으로 승부할 선수입니다.',
    '성실함으로 자리를 지키는 유형이에요. 그것도 재능입니다.',
    '경험으로 버티는 선수가 될 겁니다. 오래 뛸 거예요.',
  ],
};
/** 시즌 결산의 스카우트 한마디(스카우트가 직접 하는 말). 등급 글자 없이 스카우트 평가(potGrade)의 수준만 문장으로 알려 준다.
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
