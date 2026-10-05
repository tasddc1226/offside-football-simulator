import type { Translation } from '@offside/contracts/i18n';
import type { GSeasonMsgs } from '../ko/gSeason';
import { ordinal, plural } from './_gUtil';

export const gSeason: Translation<GSeasonMsgs> = {
  seasonEnd: (p) =>
    `${p.year} season over · ${p.league}: ${ordinal(p.rank)} · ${p.apps} official ${plural(p.apps, 'match', 'matches')}, ${p.goals} ${plural(p.goals, 'goal', 'goals')}, ${p.assists} ${plural(p.assists, 'assist', 'assists')}`,
  cwcNote: (p) => `Club World Cup: ${p.stage}`,
  exemptNote: (p) => `Military service waived · ${p.what}`,
  promoted: (p) =>
    `${p.club} promoted to the ${p.league}! Next season is in the ${p.league} (${p.down} relegated)`,
  roleStarter: 'Starter guaranteed',
  roleRotation: 'Rotation',
  roleBench: 'Fight for a place',
  roleCoach: 'Your old coach calls · Strong manager trust',
  roleTrial: 'Passed the trial · Semi-pro',
  roleComeback: 'Lower league · Fresh start',
  serveName: 'Keep serving at Gimcheon Sangmu',
  serveDesc: (p) =>
    `${p.left} ${plural(p.left, 'season', 'seasons')} until discharge · You cannot transfer during military service`,
  serveNote: 'You are serving with the Armed Forces Athletic Corps.',
  dueNote: (p) =>
    `You are ${p.age}. You cannot put off enlistment any longer. You have to complete your military service.`,
  hsNoteOffers: 'Pro clubs have sent offers as you near graduation.',
  hsNoteNone: 'No pro scout has noticed you yet. You need to keep improving at university.',
  uniName: 'Go to university',
  uniDesc:
    'Turn pro whenever you like within four years · Regular game time in the university league',
  uniNote: (p) => `You finished year ${p.years} of university.`,
  uniStayName: 'Stay at university',
  uniStayDesc: (p) => `One more season as a year ${p.year} student`,
  trialNote: 'Final year. No pro club made an offer, but you passed a trial with a K3 League club.',
  gradNote: 'Final year. No team got in touch. You may have to give up on your dream.',
  stayName: (p) => `Stay at ${p.club}`,
  stayDesc: (p) =>
    `Salary ${p.salary} · ${p.years} ${plural(p.years, 'year', 'years')} left on your contract`,
  stayDescPromoted: (p) =>
    `Take on the ${p.league} with this club · Salary ${p.salary} · ${p.years} ${plural(p.years, 'year', 'years')} left on your contract`,
  extendName: (p) => `Extend with ${p.club}`,
  extendDesc: 'The new salary applies from this season.',
  contractLeftNote: (p) =>
    `Your contract with ${p.club} has ${p.years} ${plural(p.years, 'year', 'years')} left.`,
  renewName: (p) => `Renew with ${p.club}`,
  renewVeteranDesc: 'Veteran renewal',
  faNote: 'Your contract has expired and you are a free agent.',
  promotedNote: (p) => `${p.club} are promoted to the ${p.league}! ${p.note}`,
  retireAgeNote: (p) =>
    `You are ${p.age} and can no longer play as an active player. Time to decide on retirement.`,
  noTeamNote: 'No team is calling any more. Time to decide on retirement.',
  veteranNote: (p) => `${p.note} You retire at ${p.age}.`,
  enrolled: (p) => `You enrolled at ${p.club}.`,
  renewExtLog: (p) =>
    `Extended with ${p.club} by ${p.ext} ${plural(p.ext, 'year', 'years')}, ${p.total} years in all including the time left. New salary of ${p.salary} from this season`,
  renewLog: (p) =>
    `Renewed with ${p.club} for ${p.years} ${plural(p.years, 'year', 'years')}, salary ${p.salary}`,
  signLog: (p) =>
    `Signed for ${p.club} (${p.league})! ${p.years} ${plural(p.years, 'year', 'years')} · salary ${p.salary}`,
  transferPaidLog: (p) =>
    `Transfer: ${p.from} → ${p.club} (${p.league}). Fee ${p.fee} · ${p.years} ${plural(p.years, 'year', 'years')} · salary ${p.salary}`,
  transferFreeLog: (p) =>
    `Transfer: ${p.from} → ${p.club} (${p.league}). Free agent · ${p.years} ${plural(p.years, 'year', 'years')} · salary ${p.salary}`,
  retireLog: (p) => `At ${p.age}, you hang up your boots.`,
  lgGoals: 'Goal contributions',
  lgAssists: 'Assist contributions',
  lgCs: 'Clean sheets',
  lgApps: 'Appearances',
  lgTrophies: 'Trophies',
  lgAwards: 'Individual awards',
  lgCaps: 'Caps',
  lgPeak: 'Peak OVR',
  lgBallonWin: "Ballon d'Or wins",
  lgBallonRank: "Ballon d'Or rankings",
  lgWc: 'World Cup wins',
  lgCentury: 'Century club',
  lgControl: 'Match control',
};
