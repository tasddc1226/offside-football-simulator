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

/** now(UTC ISO) 시점에 진행 중인 시즌. 개막 전이거나 마감 뒤면 undefined. */
export const activeSeason = (now: string): ServiceSeason | undefined =>
  SERVICE_SEASONS.find((s) => s.startsAt <= now && (s.endsAt === null || now < s.endsAt));

/**
 * T-10-092 팀 시즌: now에 만들고 겨루는 팀의 시즌. 진행 중인 시즌 id, 첫 시즌 개막 전이면 0(프리시즌), 시즌 사이
 * 휴식기면 null(팀을 고치거나 경기하지 않는다).
 */
export const teamSeasonAt = (now: string): number | null =>
  activeSeason(now)?.id ?? (now < SERVICE_SEASONS[0]!.startsAt ? 0 : null);

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
