import type { Translation } from '../core';
import type { RenameMsgs } from '../ko/rename';

export const rename: Translation<RenameMsgs> = {
  title: 'Rename player',
  entry: 'Rename',
  entryLabel: (p) => `Rename ${p.name}`,
  lead: 'Use 1 ticket to rename this player. The new name shows in the Hall of Fame, the transfer market and club matches.',
  label: 'New name',
  have: (p) => `Rename tickets: ${p.n}`,
  btn: 'Use 1 ticket and rename',
  busy: 'Renaming…',
  done: (p) => `Renamed to ${p.name}.`,
  fail: "Couldn't rename the player. Please try again in a moment.",
  empty: 'Enter a name.',
  invalid: "That name can't be used. Try another one.",
  same: 'That is already the current name.',
  none: 'You have no rename tickets. You get 1 on day 28 of daily check-in.',
  noneApp: 'You have no rename tickets. Get 1 on day 28 of daily check-in, or buy some below.',
  guest: 'Sign in to rename players with rename tickets.',
  close: 'Close',
  shopTitle: 'Player rename tickets',
  shopHave: (p) => `Rename tickets: ${p.n}`,
  shopWeb: 'Rename tickets are sold in the app.',
  shopNote:
    'Rename a current player next to the name on the player screen, and retired or signed players from My players.',
};
