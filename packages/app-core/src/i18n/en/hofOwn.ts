import type { Translation } from '../core';
import type { HofOwnMsgs } from '../ko/hofOwn';

export const hofOwn: Translation<HofOwnMsgs> = {
  publishTitle: 'Show your name in the Hall of Fame',
  publishBefore:
    'Retirement records go into the Hall of Fame, which every player can see. Right now your player is listed',
  publishNamed: (p) => `as "${p.name}"`,
  publishAnon: 'anonymously',
  publishAfter: 'there.',
  publishHint:
    "Making your name public lets other players see your player's name. Avoid real names.",
  publishWarn: 'Everyone can see this name. Avoid using a real name.',
  publishBlocked:
    "This name has a link or profanity, so it can't be made public. It appears anonymously in the Hall of Fame.",
  publishRevert: 'Make anonymous again',
  publishOn: 'Make name public',
  shortTitle: 'Kept on your player only',
  reportTitle: (p) => `Report the name '${p.name}'?`,
  reportBody: 'Moderators will review it.',
  reportConfirm: 'Report',
  reportSent: "Reported. We'll take a look.",
  reportDone: 'Reported',
  reportTeamBtn: 'Report club name',
  reportPlayerBtn: 'Report player name',
  reportLabel: (p) => `Report the name ${p.name}`,
  reportNickTitle: (p) => `Report the nickname '${p.name}'?`,
  reportNickBtn: 'Report nickname',
  reportNickLabel: (p) => `Report the nickname ${p.name}`,
  nickSaved: 'Nickname saved',
  nickLabel: 'Owner name',
  nickPlaceholder: (p) => `Owner name (2–${p.max} characters)`,
  nickChange: 'Change',
  nickSet: 'Set',
  anonCardsNote: (p) =>
    `${p.n} of your players were uploaded anonymously. Their names are still on this device, so you can publish them now.`,
  anonCardsBtn: 'Publish names',
  anonCardsConfirm: (p) =>
    `Publish the names of ${p.n} players? Other users and the transfer market will see these names.`,
  anonCardsDone: (p) => `Published ${p.n} names.`,
  anonCardsFail: 'Couldn’t publish the names. Please try again in a moment.',
};
