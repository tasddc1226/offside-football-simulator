import type { OwnerTitlesResponse } from './api/ownerProfile.js';
import { parseTitle, permanentTitleOf } from './ownerTitle.js';

/** One selectable card per earned title; nearest unfinished goals first, ties keep catalog order. */
export function titleCollection(hall: Pick<OwnerTitlesResponse, 'titles' | 'permanent'>) {
  const earned = [
    ...new Set([...hall.permanent.filter((t) => t.earnedAt).map((t) => t.id), ...hall.titles]),
  ].filter((id) => permanentTitleOf(id) || parseTitle(id));
  const locked = hall.permanent
    .filter((t) => !t.earnedAt)
    .sort((a, b) => b.value / b.target - a.value / a.target);
  return { earned, locked, cups: earned.filter((id) => parseTitle(id)) };
}
