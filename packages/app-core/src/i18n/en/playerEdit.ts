import type { Translation } from '../core';
import type { PlayerEditMsgs } from '../ko/playerEdit';

export const playerEdit: Translation<PlayerEditMsgs> = {
  title: 'Edit player info',
  entry: 'Edit',
  entryLabel: (p) => `Edit ${p.name}'s info`,
  hint: 'Until the first season review, you can change name, preferred foot and build for free.',
  lead: 'Free and unlimited until the first season review. After that, the name can only be changed with a rename ticket.',
  name: 'Name',
  nameRule: (p) => `Up to ${p.max} characters. Links, profanity, and < > aren't allowed.`,
  nameEmpty: 'Enter a name.',
  nameInvalid: "That name can't be used. Try another one.",
  body: 'Build',
  height: 'Height',
  weight: 'Weight',
  heightRange: (p) => `Enter a height between ${p.min} and ${p.max} cm.`,
  weightRange: (p) => `Enter a weight between ${p.min} and ${p.max} kg.`,
  tooLight: 'Weight is too low for this height.',
  tooHeavy: 'Weight is too high for this height.',
  bodyNote: 'OVR stays the same. Only the spread of detailed attributes shifts.',
  ovrMove: (p) =>
    `OVR ${p.from} → ${p.to}. This player's OVR uses the higher of two roles, so build can change it.`,
  bodyPlayed: 'Growth so far stays. Only the build adjustment moves.',
  bodyNone: 'This player was created before build was added, so build cannot be changed.',
  preview: 'Detailed attributes that change',
  previewNone: 'No detailed attributes change.',
  foot: 'Preferred foot',
  footNote:
    "Preferred foot doesn't affect your player's match results. It only matters when the player card is placed at full-back or winger in club matches.",
  save: 'Save',
  close: 'Close',
  same: 'Nothing changed.',
  done: 'Player info updated.',
  closed: 'The first season review is done, so this can no longer be changed.',
};
