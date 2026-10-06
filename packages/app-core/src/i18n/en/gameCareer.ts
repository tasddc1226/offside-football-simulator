import type { Translation } from '../core';
import type { GameCareerMsgs } from '../ko/gameCareer';

export const gameCareer: Translation<GameCareerMsgs> = {
  totalsTitle: 'Career totals',
  apps: 'Apps',
  goals: 'Goals',
  assists: 'Assists',
  cleanSheets: 'Clean sheets',
  awards: 'Honours',
  peakValue: 'Peak market value',
  goalsTitle: 'Next goals',
  goalsNote:
    'Appearances, goals and assists count completed seasons. National team caps and trophies also go on your career.',
  goalLine: (p) => `${p.have} / ${p.target} · ${p.remaining} to go`,
  clubApps: (p) => `${p.target} appearances for ${p.club}`,
  retiredNumber: (p) =>
    `If you play for one club for a long time and retire, that club may retire your number ${p.n}.`,
  colSeason: 'Season',
  colClub: 'Club',
  colRating: 'Rating',
  colRank: 'Pos.',
  seasonValue: (p) => `Value ${p.value}`,
  emptyRecords: 'Your records build up after your first season.',
  recordsNote:
    'Apps, goals and assists cover all official matches in the league, cups and continental competitions. Market value is an estimate of the transfer fee, based on your league, OVR and age at the end of the season.',
  journeyTitle: 'Career milestones',
  emptyJourney: 'Milestones build up from your pro debut.',
  coachNoStart: 'There is no record of your attributes at the start of this season.',
  coachOvr: (p) => `OVR this season ${p.from} → ${p.to}.`,
  coachNoChange: 'No attribute changes to show yet.',
  coachServing:
    "You're on military service. After it ends, you'll prepare for club training and matches again.",
  coachInjured: (p) =>
    `You're out for ${p.n} more match${p.n === 1 ? '' : 'es'} with injury. Check your recovery first.`,
  coachLowCond:
    'Low condition raises your injury risk. Rest and recovery help you get ready to play.',
  coachLowMorale:
    'With low morale, the same training brings less growth. Rest and recovery can lift your morale.',
  coachLopsided: (p) =>
    `${p.attr} is ahead of your other key attributes, so training it brings less growth. Work on your other key attributes.`,
  coachRounded:
    'OVR is a rounded overall figure. Two players with the same OVR can have different detailed attributes.',
  coachDisclaimer: "This note alone can't pinpoint why growth has stalled or where your limit is.",
  marketAssess: (p) =>
    `Current OVR ${p.ovr} · ${p.rating === null ? '' : `last season's rating ${p.rating} · `}fame ${p.fame} · age ${p.age}. Clubs weigh your ability, last season's rating, fame and age together. League conditions and scout or agent events also affect offers. A strong run doesn't guarantee an offer from a particular club.`,
  offerAssess: (p) =>
    `Current OVR ${p.ovr} · team strength ${p.str}. The playing-time terms offered: ${p.role || 'not specified'}. Actual playing time depends on condition, injuries, manager trust and more.`,
};
