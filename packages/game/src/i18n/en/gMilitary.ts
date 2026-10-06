import type { Translation } from '@offside/contracts/i18n';
import type { GMilitaryMsgs } from '../ko/gMilitary';
import { theLeague } from './_gUtil';

const s = (n: number) => (n === 1 ? '' : 's');

export const gMilitary: Translation<GMilitaryMsgs> = {
  sportsNotice:
    'Korean players who are named to the squad and win Asian Games gold or an Olympic gold, silver or bronze medal get a military service exemption. You keep playing without joining Sangmu (the military football team) or the army. Matches played do not matter, and winning the Asian Cup or World Cup does not count. Legally you become a sports service member: you complete basic military training and 544 hours of volunteer work, and your service ends once you have played for 34 months. In the game this fills in automatically as seasons pass. If you switch over from Sangmu, the time and volunteer hours are cut down to the share of Sangmu service you have left, and you do not repeat training you have already done.',
  sportsLegacyNotice:
    'Older exemption records have no service period, so the time left is not shown. Your exemption and career are unaffected.',
  sportsGranted: (p) =>
    `You qualify for a military service exemption. Winning the ${p.medal} means you keep playing without joining Sangmu or the army.${
      p.serving
        ? ' Once you finish this season of Sangmu service, you switch to sports service. The time and volunteer hours are cut down to the share of Sangmu service you have left, and you do not repeat training you have already done.'
        : ' Legally you become a sports service member: you complete basic military training and 544 hours of volunteer work, and your service ends once you have played for 34 months.'
    }`,
  sportsDoneLog:
    'You have finished your sports service. Basic military training and volunteer work are done too.',
  sportsDoneNote: 'Sports service complete',

  statusForeign: 'Not applicable (foreign national)',
  statusExemptServing: (p) =>
    `Switching to sports service · leaves Sangmu after the season (${p.exempt})`,
  statusExemptLegacy: (p) => `Sports service exemption · older record (${p.exempt})`,
  statusExemptLeft: (p) =>
    `Exempt · serving sports service · about ${p.seasons} season${s(p.seasons)} left (${p.exempt})`,
  statusExemptDone: (p) => `Exempt · sports service complete (${p.exempt})`,
  statusServing: (p) => `Serving at Sangmu · ${p.left} season${s(p.left)} until discharge`,
  statusServedArmy: 'Discharged from the army',
  statusServedSangmu: 'Discharged from Sangmu',
  statusAccepted: 'Accepted by Sangmu · waiting to enlist',
  statusArmyNext: 'Enlisting in the army after the season',
  statusApplied: 'Applied to Sangmu · result after the season',
  statusUnservedAmateur: 'Not yet served',
  statusUnserved: (p) => `Not yet served · must serve by age ${p.age}`,

  sangmuName: (p) =>
    p.due
      ? 'Armed Forces Athletic Corps (Sangmu): last chance'
      : 'Armed Forces Athletic Corps (Sangmu): extra intake',
  sangmuDesc: (p) =>
    `${p.pct}% chance of acceptance · 2 seasons of service at Gimcheon Sangmu in K League 1${p.abroad ? ' · your contract with your club abroad is terminated' : ' · you return to your parent club afterwards'}${p.due ? ' · if rejected, you enlist in the army' : ' · if rejected, you stay at your current club'}`,
  armyName: (p) => (p.due ? 'Enlist in the army' : 'Enlist in the army (early)'),
  armyDesc: (p) =>
    `18 months of service · no official matches for 2 seasons${p.abroad ? ' · contract with your club abroad terminated' : ''}, then talks to return to your club`,
  armyNote: 'Your call-up papers have arrived. As planned, you are enlisting in the army.',
  serveName: 'Join Gimcheon Sangmu',
  serveDesc: (p) =>
    `2 seasons of service · K League 1${p.abroad ? ` · ${p.from} contract terminated` : ` · return to ${p.from} afterwards`}${p.clash ? ' · you can still be called up to the national team, and a medal moves you to sports service' : ''}`,
  serveNote: (p) =>
    p.clash.length
      ? `Your name is on the list of successful Sangmu applicants. The ${p.clash.join(' and ')} take place during your service. You can still be called up to the national team while at Sangmu.`
      : 'Your name is on the list of successful Sangmu applicants.',
  hopeAg: (p) => `${p.y} Asian Games`,
  hopeOl: (p) => `${p.y} Olympics`,

  enlistAbroad: (p) =>
    `You enlist in the Armed Forces Athletic Corps. Your contract with ${p.club} is terminated, and you return home to pull on a Gimcheon Sangmu jersey. Your service lasts 2 seasons.`,
  enlistHome:
    'Accepted by the Armed Forces Athletic Corps! You pull on a Gimcheon Sangmu jersey. Your service lasts 2 seasons.',
  armyDone: (p) =>
    `You finished 18 months of army service and were discharged. Your body needs rebuilding. ${p.abroad ? `Your contract with ${p.club} ended when you enlisted, so you need a new club.` : `You set out to win your place back in ${theLeague(p.league)}.`}`,
  sangmuAcceptedLog:
    'Accepted by the Armed Forces Athletic Corps! You join Gimcheon Sangmu next season.',
  sangmuRejectedLog:
    'Rejected by the Armed Forces Athletic Corps. You can apply again at the next intake.',
  returnedLog: (p) =>
    `${p.early ? 'You finished your Sangmu service and switched to sports service' : 'You were discharged from Gimcheon Sangmu'}! ${p.abroad ? `You enter talks to return to ${p.club}, which you left when your contract was terminated.` : `You return to your parent club, ${p.club}.`}`,

  noteCancelled: 'Sangmu application canceled (military exemption)',
  noteAccepted: 'Accepted by Sangmu · enlist next season',
  noteRejected: 'Rejected by Sangmu',
  noteOneLeft: '1 season of Sangmu service left',
  noteReturned: (p) =>
    `${p.early ? 'Switched to sports service' : 'Discharged from Sangmu'} → ${p.abroad ? `return talks with ${p.club}` : `back to ${p.club}`}`,

  resultServeFirst:
    'You joined Gimcheon Sangmu. You will play in K League 1 for 2 seasons to fulfill your military service.',
  resultServeNext: (p) =>
    `You continue your service at Gimcheon Sangmu. ${p.left} season${s(p.left)} left until discharge.`,
  resultSangmuPass:
    'Accepted by the Armed Forces Athletic Corps! You will play for Gimcheon Sangmu for 2 seasons to fulfill your military service.',
  resultSangmuFailArmy:
    'Rejected by Sangmu… Age 28 is the enlistment deadline, so you enlisted in the army. You will be back on the pitch in 18 months.',
  resultSangmuFailNoTeam:
    'Rejected by Sangmu. You can apply again at the next intake. First, decide where you will play.',
  resultSangmuFailStay:
    'Rejected by Sangmu. You play one more season at your current club and try again.',
  resultArmy:
    'You enlisted in the army. You will be discharged in 18 months and start preparing for your return.',
};
