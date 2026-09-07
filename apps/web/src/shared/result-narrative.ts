// UX-010 P2a·P2c: 경기·시즌 결과 위에 붙는 한 줄 서사 헤드라인. 팩이 만드는 콘텐츠가 아니라
// 사람이 미리 쓴 정적 카피 뱅크다 — 런타임에 문장을 짓지 않고, 결과 데이터(승/무/패, 평점, 득점·
// 도움 유무, 챕터 성공/실패, 리그 순위·승격/강등)로 미리 정해둔 분기(버킷) 하나를 고른 뒤 그 안의
// 2~3개 변형 중 하나를 시드로 결정론적으로 골라 돌려준다. 시드가 같으면(같은 careerId·같은 경기
// 또는 시즌) 항상 같은 변형이 나온다 — `Math.random`을 쓰지 않는다(브리프 제약).

/** 평점(×10 정수) 상위·하위 문턱값. 두 헤드라인 함수가 같은 기준을 공유한다. */
const HIGH_RATING_TENTHS = 75;
const LOW_RATING_TENTHS = 55;

/** FNV-1a 32bit. 암호학적 용도가 아니라 정적 배열에서 결정론적 인덱스를 고르는 용도다. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pickVariant(variants: readonly string[], seed: string): string {
  return variants[hashSeed(seed) % variants.length]!;
}

// ---------------------------------------------------------------------------
// P2a: 챕터 화면 "경기 결과"(FULL TIME) 헤드라인.
// ---------------------------------------------------------------------------

export type MatchOutcome = 'WIN' | 'DRAW' | 'LOSS';

/** 이 경기에 핵심 경기 챕터가 있었을 때 그 챕터가 평점에 더한 부호. 챕터가 없으면 null. */
export type ChapterOutcomeTone = 'SUCCESS' | 'NEUTRAL' | 'FAIL' | null;

export interface MatchResultHeadlineInput {
  /** 저장값 기반 고정 시드(예: `${careerId}:${matchId}`). Math.random 금지 — 같은 경기는 항상 같은 문구. */
  seed: string;
  outcome: MatchOutcome;
  /** 미집계(결장 등)면 null. */
  ratingTenths: number | null;
  scored: boolean;
  assisted: boolean;
  chapterOutcome: ChapterOutcomeTone;
}

const MATCH_HEADLINES = {
  WIN_STANDOUT: ['혼자 힘으로 만든 값진 승리', '이름을 새긴 완벽한 승리', '모두가 기억할 활약'],
  WIN_SOLID: ['함께 지켜낸 승리', '묵묵히 제 몫을 다한 하루', '팀과 함께 웃은 승리'],
  DRAW_BRIGHT: ['패배를 막아낸 결정적인 한 걸음', '무승부 속에서도 빛난 존재감'],
  DRAW_EVEN: ['팽팽했던 접전, 승부는 다음으로', '한 끗 차이로 갈리지 못한 승부'],
  LOSS_BRIGHT: ['패배 속에서도 남긴 인상', '졌지만 진 것만은 아닌 경기'],
  LOSS_HARD: ['쉽지 않았던 하루', '다음을 기약하는 결과', '아쉬움이 짙게 남은 경기'],
} as const satisfies Record<string, readonly string[]>;

type MatchResultBucket = keyof typeof MATCH_HEADLINES;

/** 승/무/패에 평점·득점·도움·챕터 성공 여부를 더해 버킷 하나를 고른다(내보내 단위 테스트한다). */
export function matchResultBucket(input: MatchResultHeadlineInput): MatchResultBucket {
  const highRating = input.ratingTenths !== null && input.ratingTenths >= HIGH_RATING_TENTHS;
  const lowRating = input.ratingTenths !== null && input.ratingTenths < LOW_RATING_TENTHS;
  const standout = highRating || input.scored || input.assisted || input.chapterOutcome === 'SUCCESS';
  const rough = lowRating || input.chapterOutcome === 'FAIL';
  switch (input.outcome) {
    case 'WIN':
      return standout ? 'WIN_STANDOUT' : 'WIN_SOLID';
    case 'DRAW':
      return standout ? 'DRAW_BRIGHT' : 'DRAW_EVEN';
    case 'LOSS':
      return standout && !rough ? 'LOSS_BRIGHT' : 'LOSS_HARD';
  }
}

export function matchResultHeadline(input: MatchResultHeadlineInput): string {
  const bucket = matchResultBucket(input);
  return pickVariant(MATCH_HEADLINES[bucket], `${input.seed}:${bucket}`);
}

// ---------------------------------------------------------------------------
// P2c: season-result 화면 상단 헤드라인.
// ---------------------------------------------------------------------------

export interface SeasonResultHeadlineInput {
  /** 저장값 기반 고정 시드(예: `${careerId}:${historyIndex}`). */
  seed: string;
  /** 이번 시즌 리그 순위가 승격권이면 true. */
  promoted: boolean;
  /** 이번 시즌 리그 순위가 강등권이면 true(promoted와 동시에 참일 수 없다 — 호출부가 보장한다). */
  relegated: boolean;
  /** 미집계(경기 없음 등)면 null. */
  avgRatingTenths: number | null;
}

const SEASON_HEADLINES = {
  PROMOTION: ['승격권을 확보한 값진 시즌', '다음 무대를 두드린 시즌'],
  RELEGATION: ['아쉬움 속에 강등을 맞은 시즌', '버텨냈지만 지켜내지 못한 시즌'],
  TOP_FORM: ['성장 가능성을 알린 시즌', '꾸준히 빛난 한 시즌'],
  STRUGGLE: ['인내가 필요했던 시즌', '쉽지 않았던 한 해'],
  STEADY: ['한 걸음씩 나아간 시즌', '다음을 준비하는 시즌'],
} as const satisfies Record<string, readonly string[]>;

type SeasonResultBucket = keyof typeof SEASON_HEADLINES;

/** 승격 > 강등 > 평균 평점 순으로 버킷을 고른다(내보내 단위 테스트한다). */
export function seasonResultBucket(input: SeasonResultHeadlineInput): SeasonResultBucket {
  if (input.promoted) return 'PROMOTION';
  if (input.relegated) return 'RELEGATION';
  const highRating = input.avgRatingTenths !== null && input.avgRatingTenths >= HIGH_RATING_TENTHS;
  const lowRating = input.avgRatingTenths !== null && input.avgRatingTenths < LOW_RATING_TENTHS;
  if (highRating) return 'TOP_FORM';
  if (lowRating) return 'STRUGGLE';
  return 'STEADY';
}

export function seasonResultHeadline(input: SeasonResultHeadlineInput): string {
  const bucket = seasonResultBucket(input);
  return pickVariant(SEASON_HEADLINES[bucket], `${input.seed}:${bucket}`);
}
