import type { CareerState, FootballSeason, InjuryEpisode } from './types.js';

function firstReturnMatchId(season: FootballSeason, episode: InjuryEpisode): string | null {
  const occurrenceIndex = season.matches.findIndex((match) => match.id === episode.occurredAt.matchId);

  // The first actual appearance after the occurrence's contiguous injury absences is the
  // recovery return. A non-injury zero-minute match can occur before the first appearance,
  // so only minutes > 0 ends the search.
  // If the occurrence belongs to a previous season, the current season starts inside that
  // absence; the leading INJURY records establish the same boundary without a persisted marker.
  let sawInjuryAbsence = false;
  const startIndex = occurrenceIndex < 0 ? 0 : occurrenceIndex + 1;
  for (let i = startIndex; i < season.matches.length; i += 1) {
    const match = season.matches[i]!;
    if (match.outReason === 'INJURY') {
      sawInjuryAbsence = true;
      continue;
    }
    if (sawInjuryAbsence && match.minutes > 0) return match.id;
  }
  return null;
}

/**
 * Rebuilds the transient INJURY_RETURN marker after a forced injury is resolved.
 * The marker is intentionally not persisted: REHAB_CHOSEN plus existing timeline,
 * health episodes and match records are sufficient to identify the first-return match.
 */
export function findInjuryReturnMatchId(state: CareerState, season: FootballSeason, step: number): string | null {
  const rehabChosenIds = new Set(
    state.timeline
      .filter((entry) => entry.kind === 'REHAB_CHOSEN' && entry.step === step && entry.refId !== null)
      .map((entry) => entry.refId as string),
  );

  for (let i = state.health.episodes.length - 1; i >= 0; i -= 1) {
    const episode = state.health.episodes[i]!;
    if (
      !rehabChosenIds.has(episode.id) ||
      episode.status !== 'REHAB' ||
      episode.occurredAt.seasonIndex !== season.index ||
      episode.occurredAt.step !== step
    ) {
      continue;
    }
    const occurrence = season.matches.find((match) => match.id === episode.occurredAt.matchId);
    if (occurrence === undefined || occurrence.minutes <= 0) continue;

    const isFirstReturn = state.health.episodes.some(
      (prior) =>
        prior.id !== episode.id &&
        (prior.status === 'RECOVERED' || prior.status === 'RECURRED') &&
        firstReturnMatchId(season, prior) === occurrence.id,
    );
    if (isFirstReturn) return occurrence.id;
  }
  return null;
}
