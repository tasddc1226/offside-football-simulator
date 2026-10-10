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
  publishRevert: 'Make anonymous again',
  publishOn: 'Make name public',
  shortTitle: 'Kept on your player only',
  reportTitle: (p) => `Report the name '${p.name}'?`,
  reportBody: 'Moderators will review it.',
  reportConfirm: 'Report',
  reportSent: "Reported. We'll take a look.",
  reportDone: 'Reported',
  reportBtn: 'Report name',
  reportLabel: (p) => `Report the name ${p.name}`,
  reportNickTitle: (p) => `Report the nickname '${p.name}'?`,
  reportNickBtn: 'Report nickname',
  reportNickLabel: (p) => `Report the nickname ${p.name}`,
  nickSaved: 'Nickname saved',
  nickLabel: 'Comment nickname',
  nickPlaceholder: (p) => `Comment nickname (2–${p.max} characters)`,
  nickChange: 'Change',
  nickSet: 'Set',
};
