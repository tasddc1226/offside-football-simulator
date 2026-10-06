/**
 * T-10-090 서비스 시즌. zod가 없는 서브패스(`@offside/contracts/service-seasons`)라 웹이 값으로 가져와도 번들에
 * zod가 들어가지 않는다 — 서버의 시즌 순위와 웹의 개막 안내가 같은 시각을 쓴다.
 *
 * 참가 기준은 커리어가 서버에 처음 올라온(첫 시즌 업로드) 시각에 진행 중인 시즌이다 — 서버가 그때 careers.service_season에
 * 한 번 찍어 두고 바꾸지 않는다. 프리시즌에 만든 선수는 개막 전에 첫 시즌을 올리므로 시즌 순위에서 빠진다. 시즌 중에는
 * 밸런스 값을 바꾸지 않는다.
 */
export interface ServiceSeason {
  id: number;
  name: string;
  /** 개막(UTC ISO). 이 시각부터 처음 올라온 커리어가 참가한다. */
  startsAt: string;
  /** 마감(UTC ISO). null이면 아직 정하지 않았다. 마감 뒤 은퇴는 이 시즌 순위에 넣지 않는다. */
  endsAt: string | null;
  /**
   * T-11-045 이 시즌에 만든 선수의 은퇴 나이 — 그 나이가 되는 시장에서 은퇴한다(마지막 출전은 한 살 아래 시즌).
   * 선수를 만들 때 커리어에 고정되고 시즌이 바뀌어도 그대로다. 시즌 1은 45세, 그다음 시즌은 nextRetireAt으로 정한다.
   */
  retireAt: number;
}

/** T-11-045 프리시즌 선수(그리고 이 값이 생기기 전 저장)의 은퇴 나이. */
export const PRESEASON_RETIRE_AT = 41;
/** T-11-045 은퇴 나이의 끝 — 아무리 해금해도 58세 시즌이 마지막이다. */
export const RETIRE_AT_LIMIT = 59;

/**
 * T-11-045 다음 시즌의 은퇴 나이. 이 시즌 선수 중 누군가 은퇴 나이까지 뛰고 은퇴했으면(서버 최초 기록 `retirecap` —
 * `GET /v1/firsts?season=<이 시즌>`) 한 살 올리고, 아무도 못 했으면 그대로 둔다. 새 시즌을 SERVICE_SEASONS에 더할 때
 * 앞 시즌 마감 기준으로 한 번 정하고, 개막 뒤에는 바꾸지 않는다(시즌 중 은퇴 나이 고정).
 */
export const nextRetireAt = (retireAt: number, reached: boolean): number =>
  Math.min(RETIRE_AT_LIMIT, retireAt + (reached ? 1 : 0));

export const SERVICE_SEASONS: readonly ServiceSeason[] = [
  // 2026-10-06 00:00 KST
  { id: 1, name: '시즌 1', startsAt: '2026-10-05T15:00:00.000Z', endsAt: null, retireAt: 45 },
];

export const serviceSeason = (id: number): ServiceSeason | undefined =>
  SERVICE_SEASONS.find((s) => s.id === id);

/**
 * T-11-029 프리시즌(시즌 id 0). 첫 시즌 개막 전에 처음 올라온 커리어(careers.service_season = 0)가 속한다. 시즌 순위와
 * 달리 마감이 없다 — 개막 뒤에 은퇴해도 그 선수는 프리시즌 기록이다. SERVICE_SEASONS에는 없다(시즌 1.. 순서·개막 안내용).
 */
export const PRESEASON: ServiceSeason = {
  id: 0,
  name: '프리시즌',
  startsAt: '1970-01-01T00:00:00.000Z',
  endsAt: null,
  retireAt: PRESEASON_RETIRE_AT,
};

/** 프리시즌(0)을 포함해 시즌 id로 찾는다. 없는 시즌이면 undefined. */
export const seasonById = (id: number): ServiceSeason | undefined =>
  id === 0 ? PRESEASON : serviceSeason(id);

/** now(UTC ISO) 시점에 진행 중인 시즌. 개막 전이거나 마감 뒤면 undefined. */
export const activeSeason = (now: string): ServiceSeason | undefined =>
  SERVICE_SEASONS.find((s) => s.startsAt <= now && (s.endsAt === null || now < s.endsAt));

/**
 * T-10-092 팀 시즌: now에 만들고 겨루는 팀의 시즌. 진행 중인 시즌 id, 첫 시즌 개막 전이면 0(프리시즌), 시즌 사이
 * 휴식기면 null(팀을 고치거나 경기하지 않는다).
 */
export const teamSeasonAt = (now: string): number | null =>
  activeSeason(now)?.id ?? (now < SERVICE_SEASONS[0]!.startsAt ? 0 : null);

/**
 * T-11-029 기록(영구결번·최초 기록·명예의 전당 등)을 보여 줄 기본 시즌: 진행 중인 시즌, 개막 전이면 0(프리시즌),
 * 시즌 사이 휴식기면 마지막으로 개막한 시즌.
 */
export const displaySeasonAt = (now: string): number =>
  teamSeasonAt(now) ??
  SERVICE_SEASONS.filter((s) => s.startsAt <= now).reduce((id, s) => Math.max(id, s.id), 0);

/**
 * T-11-107 다음 시즌 개막까지 남은 밀리초(없으면 null). 화면을 띄운 채 개막을 넘겨도 시즌 기본값을 다시 고르게 할 때 쓴다.
 */
export const msUntilNextSeasonStart = (now: string): number | null => {
  const next = SERVICE_SEASONS.find((s) => s.startsAt > now);
  return next ? Date.parse(next.startsAt) - Date.parse(now) : null;
};

/**
 * T-11-029 홈 명예의 전당 미리보기의 시즌 — 지금 시즌 고정(휴식기면 마지막 시즌). 첫 시즌 개막 전엔 모든 선수가 프리시즌이라
 * 전체와 같으므로 null(시즌 없이 같은 요청·캐시를 쓴다).
 */
export const previewSeasonAt = (now: string): number | null =>
  now < SERVICE_SEASONS[0]!.startsAt ? null : displaySeasonAt(now);

/** 팀 시즌 이름(0 = 프리시즌). */
export const teamSeasonName = (id: number): string =>
  id === 0 ? '프리시즌' : (serviceSeason(id)?.name ?? `시즌 ${id}`);

/** 고를 수 있는 팀 시즌(프리시즌 + 개막한 시즌, 오래된 순). */
export const openTeamSeasons = (now: string): number[] => [
  0,
  ...SERVICE_SEASONS.filter((s) => s.startsAt <= now).map((s) => s.id),
];

/** T-11-113 그 팀 시즌이 끝나는 시각(프리시즌은 첫 시즌 개막, 시즌은 마감). 마감이 정해지지 않았으면 null. */
export const teamSeasonEndsAt = (id: number): string | null =>
  id === 0 ? SERVICE_SEASONS[0]!.startsAt : (serviceSeason(id)?.endsAt ?? null);

/** 그 팀 시즌이 끝났는가(프리시즌은 첫 시즌 개막에, 시즌은 마감에 끝난다). */
export const teamSeasonClosed = (id: number, now: string): boolean => {
  const end = teamSeasonEndsAt(id);
  return !!end && end <= now;
};

/** T-11-045 그 시즌(id, null이면 프리시즌) 선수의 은퇴 나이. 서버가 커리어의 service_season으로 은퇴 기록을 맞출 때 쓴다. */
export const retireAtOf = (seasonId: number | null | undefined): number =>
  seasonById(seasonId ?? 0)?.retireAt ?? PRESEASON_RETIRE_AT;

/**
 * T-11-045 now에 새로 만드는 선수의 은퇴 나이 — 서버가 첫 업로드 때 커리어에 찍는 시즌(teamSeasonAt: 개막 전이면
 * 프리시즌, 시즌 사이 휴식기면 NULL = 프리시즌 은퇴 나이)과 같은 기준이다.
 */
export const retireAtNow = (now: string): number => retireAtOf(teamSeasonAt(now));

/** T-11-045 정의된 시즌 가운데 가장 높은 은퇴 나이 — 서버가 받는 시즌 나이의 상한(이 나이 − 1)을 정한다. */
export const MAX_RETIRE_AT = Math.max(
  PRESEASON_RETIRE_AT,
  ...SERVICE_SEASONS.map((s) => s.retireAt),
);

/**
 * T-11-095 커리어가 서버에 처음 올라올 때 찍는 시즌. 세부 포지션이 없는 선수는 프리시즌 규칙(41세·세부 포지션 없음)으로
 * 만든 선수라 개막 뒤에 처음 올라와도(자정을 넘긴 첫 시즌·오프라인 플레이) 프리시즌(0)이다. 세부 포지션이 있으면 올라온
 * 시각의 시즌 — 기기 시계를 당겨 개막 전에 만든 선수가 시즌 순위에 먼저 들어오지 않게 서버 시각을 따른다.
 */
export const firstUploadSeasonAt = (now: string, seasonRules: boolean): number | null =>
  seasonRules ? teamSeasonAt(now) : 0;
