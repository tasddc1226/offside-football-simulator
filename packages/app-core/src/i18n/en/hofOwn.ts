import type { Translation } from '../core';
import type { HofOwnMsgs } from '../ko/hofOwn';

export const hofOwn: Translation<HofOwnMsgs> = {
  publishTitle: 'Show your name in the Hall of Fame',
  publishBefore:
    'Retirement records go in the Hall of Fame, which every player can see. Right now it lists your player',
  publishNamed: (p) => `as "${p.name}"`,
  publishAnon: 'anonymously',
  publishAfter: 'to everyone.',
  publishHint:
    "If you make your name public, other players can see your player's name. Avoid using real names.",
  publishRevert: 'Go back to anonymous',
  publishOn: 'Make name public',
  shortTitle: 'Kept on your player only',
  reportTitle: (p) => `Report the name '${p.name}'?`,
  reportBody: 'Moderators will review it.',
  reportConfirm: 'Report',
  reportSent: "Reported. We'll take a look.",
  reportDone: 'Reported',
  reportBtn: 'Report name',
  reportLabel: (p) => `Report the name ${p.name}`,
  nickSaved: 'Nickname saved',
  nickLabel: 'Comment nickname',
  nickPlaceholder: (p) => `Comment nickname (2–${p.max} characters)`,
  nickChange: 'Change',
  nickSet: 'Save',
};
