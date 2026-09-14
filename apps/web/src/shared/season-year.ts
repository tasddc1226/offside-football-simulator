// 사용자 결정(2026-09-13): 원작(SLB)처럼 1시즌 = 1년으로 보이게 한다. 도메인은 실제 연도를
// 저장하지 않는다(시즌은 `index`뿐이고, 시간·rng는 domain 입력으로만 받는다 — ADR-003) — 화면이
// 이미 가진 값만으로 "커리어가 시작된 연도"를 근사해 `2026 시즌`, `2027 시즌`… 라벨을 만드는
// 표시 전용 헬퍼다. 실측 달력이 아니라 근사치라는 점은 알고 쓴다(PR 본문 "한계" 참고).
//
// 우선순위:
//   (1) 커리어의 시즌이 고정한 서비스 시즌 id(`FootballSeason.serviceSeasonId`)가 지금 라이브
//       서비스 시즌(`useServiceSeason()`)과 같으면 그 시즌 `startsAt`의 연도.
//       (오늘 기준 운영 서비스 시즌은 `svc_season_1`, startsAt 2026-09-05 → 2026.)
//   (2) 룰셋 `leagueCalendar.startYear`(선택 키, 1.5.0+에 추가될 수 있다 — 아직 스키마에 없다).
//   (3) 폴백 2026.
// `state.season`이 null이면(결산 뒤·은퇴 뒤·시즌 시작 전) (1)을 판단할 서비스 시즌 id 자체가
// 없다 — 그 화면들은 (2)(3)만 쓴다(설계 노트, PR 본문 "한계" 참고).

export type CareerStartYearInput = {
  /** 이 커리어의 현재(또는 방금까지의) `FootballSeason.serviceSeasonId`. 시즌이 없으면 null. */
  seasonServiceSeasonId: string | null;
  /** `useServiceSeason()`/`resolveServiceSeason()` 응답. 조회 전이거나 이 화면에서 안 쓰면
   * null/undefined. */
  currentServiceSeason: { id: string; startsAt: string } | null | undefined;
  /** 룰셋 `leagueCalendar.startYear`(선택, 아직 스키마에 없을 수 있다) — `extractCalendarStartYear`로 뽑는다. */
  calendarStartYear?: number | null;
};

export const FALLBACK_CAREER_START_YEAR = 2026;

/** 우선순위 (1)(2)(3)으로 커리어 시작 연도를 고른다. 항상 유한한 정수를 돌려준다. */
export function careerStartYear(input: CareerStartYearInput): number {
  const { seasonServiceSeasonId, currentServiceSeason, calendarStartYear } = input;
  if (
    seasonServiceSeasonId !== null &&
    currentServiceSeason !== null &&
    currentServiceSeason !== undefined &&
    seasonServiceSeasonId === currentServiceSeason.id
  ) {
    const year = new Date(currentServiceSeason.startsAt).getUTCFullYear();
    if (Number.isFinite(year)) return year;
  }
  if (calendarStartYear !== null && calendarStartYear !== undefined && Number.isFinite(calendarStartYear)) {
    return calendarStartYear;
  }
  return FALLBACK_CAREER_START_YEAR;
}

/**
 * 룰셋 `leagueCalendar`(또는 그 어떤 값)에서 선택 키 `startYear`를 안전하게 읽는다. 콘텐츠
 * 팩·룰셋 타입에 아직 없는 필드라 도메인 타입을 넓히지 않고 런타임에서만 확인한다 — 1.5.0이
 * 실제로 필드를 추가하면 이 함수만으로 곧장 반영된다.
 */
export function extractCalendarStartYear(calendar: unknown): number | null {
  if (typeof calendar !== 'object' || calendar === null || !('startYear' in calendar)) return null;
  const value = (calendar as { startYear?: unknown }).startYear;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** 시즌 index(1부터)를 실제 연도로 치환한다. */
export function seasonYear(startYear: number, seasonIndex: number): number {
  return startYear + seasonIndex - 1;
}

/** 기본 표기: "2026 시즌". */
export function seasonYearLabel(startYear: number, seasonIndex: number): string {
  return `${seasonYear(startYear, seasonIndex)} 시즌`;
}

/** 몇 번째 시즌인지가 함께 필요한 곳(과거 시즌 목록 등)의 보조 표기: "2026 시즌 (3번째)". */
export function seasonYearLabelWithOrdinal(startYear: number, seasonIndex: number): string {
  return `${seasonYearLabel(startYear, seasonIndex)} (${seasonIndex}번째)`;
}

/**
 * 은퇴·레거시 기록의 기간 표기: "2026–2041"(같은 해면 "2026" 하나만). `fromSeasonIndex`·
 * `toSeasonIndex`는 둘 다 1부터인 시즌 index(포함).
 */
export function seasonYearRangeLabel(startYear: number, fromSeasonIndex: number, toSeasonIndex: number): string {
  const from = seasonYear(startYear, fromSeasonIndex);
  const to = seasonYear(startYear, toSeasonIndex);
  return from === to ? `${from}` : `${from}–${to}`;
}
