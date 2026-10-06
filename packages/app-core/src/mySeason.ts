// ───────── '내 선수'의 시즌 거르기 (웹·앱 공용, T-11-029) ─────────
// 선수의 시즌은 서버가 커리어를 처음 받은 시각에 한 번 정한다(careers.service_season, 0 = 프리시즌). 계정 목록은 서버가
// 준 값(PublicHofEntry.season)을 쓰고, 이 기기 기록(ft_hof)은 은퇴 업로드 응답에서 받아 HofEntry.season에 남긴 값을
// 쓴다. 옛 기록(값 없음)은 프리시즌으로 센다 — 서버가 시즌을 도입하기 전에 올라온 기록이기 때문이다.
import type { PublicHofEntry } from '@offside/contracts';
import { displaySeasonAt, openTeamSeasons } from '@offside/contracts/service-seasons';
import type { HofEntry } from '@offside/game/types';
import { gameMySeasonText as L } from './i18n/ko/gameMySeason';
import { teamSeasonLabel } from './seasonName.js';

/** 계정 목록 항목의 시즌. 값이 없거나(옛 응답) null(휴식기에 올라온 선수)이면 프리시즌으로 센다. */
export const serverSeasonOf = (e: Pick<PublicHofEntry, 'season'>): number => e.season ?? 0;

/**
 * 이 기기 은퇴 기록의 시즌. 업로드 응답으로 받은 값이 있으면 그것, 없으면 옛 기록이라 프리시즌이다. 방금 은퇴해 아직
 * 업로드 대기 중인 기록(pending)은 서버가 곧 지금 시즌으로 정하므로 지금 시즌으로 센다.
 */
export function deviceSeasonOf(
  h: Pick<HofEntry, 'id' | 'season'>,
  pending: ReadonlySet<string>,
  now: string,
): number {
  if (h.season !== undefined) return h.season;
  return h.id && pending.has(h.id) ? displaySeasonAt(now) : 0;
}

/** 고를 수 있는 시즌(개막한 시즌, 오래된 순). 하나뿐이면 고를 필요가 없다. */
export const mySeasonOptions = (now: string): { id: number; name: string }[] =>
  openTeamSeasons(now).map((id) => ({ id, name: teamSeasonLabel(id) }));

/** 처음 보여 줄 시즌 — 지금 시즌(개막 전이면 프리시즌, 휴식기면 마지막 시즌). */
export const myDefaultSeason = (now: string): number => displaySeasonAt(now);

/** 고른 시즌에 선수가 없을 때의 안내 — 다른 시즌에 있으면 그 수를 알려 준다. */
export function emptySeasonText(season: number, total: number): string {
  return total > 0 ? L.emptyOther({ name: teamSeasonLabel(season), total }) : L.emptyNone;
}
