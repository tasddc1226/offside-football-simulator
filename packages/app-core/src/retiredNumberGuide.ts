import type { RetiredNumberProgress } from '@offside/contracts';
import { gameCareerText } from './i18n/ko/gameCareer.js';
export type RnProgressClub = RetiredNumberProgress['clubs'][number];
export function retiredNumberNext(club: RnProgressClub, minSeasons: number): string {
  const L = gameCareerText;
  if (club.availability === 'taken') return L.rnTakenHint;
  if (club.seasons < minSeasons) return L.rnRemain({ count: minSeasons - club.seasons });
  if (!club.eligible) return L.rnBuild;
  // T-11-429 지금 구단에서 은퇴해야 기준을 넘는 구단은 이적하면 놓친다고 먼저 알린다.
  if (club.candidate && club.leaveRisk) return L.rnLeaveRisk;
  return club.candidate ? L.rnReady : L.rnOutside;
}
