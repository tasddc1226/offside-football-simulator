// UX-010 P2a·P2c: 경기·시즌 결과 위에 붙는 한 줄 서사 헤드라인. 팩이 만드는 콘텐츠가 아니라
// 사람이 미리 쓴 정적 카피 뱅크다 — 런타임에 문장을 짓지 않고, 결과 데이터(승/무/패, 평점, 득점·
// 도움 유무, 챕터 성공/실패, 리그 순위·승격권/강등권)로 미리 정해둔 분기(버킷) 하나를 고른 뒤
// 준비된 변형 중 하나를 시드로 결정론적으로 골라 돌려준다. 시드가 같으면(같은 careerId·같은 경기
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

function pickVariant(
  variants: readonly string[],
  seed: string,
  excludedVariant: string | null = null,
): string {
  const firstIndex = hashSeed(seed) % variants.length;
  for (let offset = 0; offset < variants.length; offset += 1) {
    const variant = variants[(firstIndex + offset) % variants.length]!;
    if (variant !== excludedVariant) return variant;
  }
  return variants[firstIndex]!;
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
  /** 저장값 기반 고정 시드(현재는 careerId). */
  seed: string;
  /** 저장된 SeasonResult.index. 같은 커리어의 시즌별 변형을 가르는 시드에 반드시 포함한다. */
  seasonIndex: number;
  /** 이번 시즌 리그 순위가 승격권이면 true. */
  promoted: boolean;
  /** 이번 시즌 리그 순위가 강등권이면 true(promoted와 동시에 참일 수 없다 — 호출부가 보장한다). */
  relegated: boolean;
  /** 미집계(경기 없음 등)면 null. */
  avgRatingTenths: number | null;
  /** 저장된 리그 순위. 컵만 뛴 시즌·순위 미확정이면 null. */
  leaguePosition: number | null;
  /** 저장된 시즌의 리그 팀 수. 리그를 식별할 수 없으면 null. */
  leagueTeamCount: number | null;
  /** 저장된 promiseFulfilment.minutesShareBp를 반올림한 실제 출전 시간 비율. */
  appearanceRatePercent: number | null;
  /** 저장된 시즌 출전 시간. 0분과 미기록(null)을 구분해 문구가 결장을 추정하지 않게 한다. */
  minutesPlayed: number | null;
  /** 같은 함수로 과거 저장 시즌을 순서대로 재구성한 직전 시즌 문구. */
  previousHeadline?: string | null;
}

type SeasonHeadlineVariant = (input: SeasonResultHeadlineInput) => string;

function leagueStandingText(input: SeasonResultHeadlineInput): string | null {
  if (input.leaguePosition === null) return null;
  return input.leagueTeamCount === null
    ? `${input.leaguePosition}위`
    : `${input.leaguePosition}위/${input.leagueTeamCount}팀`;
}

function ratingText(input: SeasonResultHeadlineInput): string | null {
  return input.avgRatingTenths === null ? null : (input.avgRatingTenths / 10).toFixed(1);
}

function steadyCopy(
  input: SeasonResultHeadlineInput,
  appeared: string,
  noMinutes: string,
  unavailable: string,
): string {
  if (input.minutesPlayed === 0) return noMinutes;
  if (input.minutesPlayed === null) return unavailable;
  return appeared;
}

const SEASON_HEADLINES = {
  PROMOTION: [
    () => '승격권을 확보한 값진 시즌',
    () => '다음 무대를 두드린 시즌',
    () => '상위권 경쟁에 이름을 남긴 시즌',
    (input) => {
      const standing = leagueStandingText(input);
      return standing === null
        ? '순위표 위에서 승격권을 확보한 시즌'
        : `${standing}로 승격권을 확보한 시즌`;
    },
    (input) =>
      input.appearanceRatePercent === null
        ? '승격권 성적과 함께 다음을 준비한 시즌'
        : `출전 비율 ${input.appearanceRatePercent}%와 승격권 성적을 함께 기록한 시즌`,
  ],
  RELEGATION: [
    () => '아쉬움 속에 강등권에서 마친 시즌',
    () => '끝까지 버텼지만 강등권을 벗어나지 못한 시즌',
    () => '강등권 순위를 기록하고 반등을 준비한 시즌',
    (input) => {
      const standing = leagueStandingText(input);
      return standing === null
        ? '순위표 아래에서 반등을 준비하는 시즌'
        : `${standing}로 마친 힘겨운 시즌`;
    },
    (input) =>
      input.appearanceRatePercent === null
        ? '강등권 성적을 뒤로하고 다음을 준비한 시즌'
        : `출전 비율 ${input.appearanceRatePercent}%와 강등권 성적을 함께 기록한 시즌`,
  ],
  TOP_FORM: [
    () => '성장 가능성을 알린 시즌',
    () => '꾸준히 빛난 한 시즌',
    () => '좋은 흐름을 오래 이어간 시즌',
    (input) => {
      const rating = ratingText(input);
      return rating === null
        ? '좋은 평점을 꾸준히 쌓은 시즌'
        : `평균 평점 ${rating}, 존재감을 증명한 시즌`;
    },
    (input) =>
      input.appearanceRatePercent === null
        ? '활약으로 자신의 자리를 넓힌 시즌'
        : `출전 비율 ${input.appearanceRatePercent}%와 좋은 흐름을 함께 남긴 시즌`,
  ],
  STRUGGLE: [
    () => '인내가 필요했던 시즌',
    () => '쉽지 않았던 한 해',
    () => '결과보다 배움을 남긴 시즌',
    (input) => {
      const rating = ratingText(input);
      return rating === null
        ? '평점을 남기지 못하고 반등을 준비한 시즌'
        : `평균 평점 ${rating}, 반등의 출발점을 찾는 시즌`;
    },
    (input) =>
      input.appearanceRatePercent === null
        ? '제한된 기회 속에서 답을 찾던 시즌'
        : `출전 비율 ${input.appearanceRatePercent}% 속에서 답을 찾던 시즌`,
  ],
  STEADY: [
    (input) =>
      steadyCopy(
        input,
        '한 걸음씩 나아간 시즌',
        '공식 경기 출전 없이 마친 시즌',
        '한 시즌을 마치고 다음을 준비한 해',
      ),
    (input) =>
      steadyCopy(
        input,
        '다음을 준비하는 시즌',
        '출전 시간 0분으로 기록된 시즌',
        '다음 목표를 정리하는 시즌',
      ),
    (input) =>
      steadyCopy(
        input,
        '흔들림 없이 경험을 쌓은 시즌',
        '경기 출전 기록을 남기지 못한 시즌',
        '결산 기록을 차분히 돌아본 시즌',
      ),
    (input) => {
      const standing = leagueStandingText(input);
      return steadyCopy(
        input,
        standing === null ? '자신의 자리를 지키며 마친 시즌' : `${standing}에서 마친 한 시즌`,
        standing === null ? '출전 기록 없이 마친 시즌' : `${standing}, 출전 기록 없이 마친 시즌`,
        standing === null ? '팀과 함께 시즌을 마친 한 해' : `${standing}에서 시즌을 마친 한 해`,
      );
    },
    (input) =>
      input.minutesPlayed === null
        ? '팀과 함께 한 해를 마친 시즌'
        : input.minutesPlayed === 0
          ? '출전 비율 0%로 마친 시즌'
          : input.appearanceRatePercent === null
            ? '경기 출전 기록과 함께 시즌을 마친 해'
            : `출전 비율 ${input.appearanceRatePercent}%를 기록한 시즌`,
  ],
} as const satisfies Record<string, readonly SeasonHeadlineVariant[]>;

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
  const variants = SEASON_HEADLINES[bucket].map((variant) => variant(input));
  return pickVariant(
    variants,
    `${input.seed}:${input.seasonIndex}:${bucket}`,
    input.previousHeadline ?? null,
  );
}
