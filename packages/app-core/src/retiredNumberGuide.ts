import type { RetiredNumberProgress } from '@offside/contracts';
import { gameCareerText } from './i18n/ko/gameCareer.js';
export type RnProgressClub = RetiredNumberProgress['clubs'][number];
export function retiredNumberNext(club: RnProgressClub, minSeasons: number): string {
  const L = gameCareerText;
  if (club.availability === 'taken') return L.rnTakenHint;
  if (club.seasons < minSeasons) return L.rnRemain({ count: minSeasons - club.seasons });
  if (!club.eligible) return L.rnBuild;
  return club.candidate ? L.rnReady : L.rnOutside;
}
