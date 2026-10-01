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
}

export const SERVICE_SEASONS: readonly ServiceSeason[] = [
  // 2026-10-06 00:00 KST
  { id: 1, name: '시즌 1', startsAt: '2026-10-05T15:00:00.000Z', endsAt: null },
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

/** 그 팀 시즌이 끝났는가(프리시즌은 첫 시즌 개막에, 시즌은 마감에 끝난다). */
export const teamSeasonClosed = (id: number, now: string): boolean => {
  if (id === 0) return SERVICE_SEASONS[0]!.startsAt <= now;
  const end = serviceSeason(id)?.endsAt;
  return !!end && end <= now;
};
