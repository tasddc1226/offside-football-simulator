import type { Translation } from '../core';
import type { OwnerPlayersMsgs } from '../ko/ownerPlayers';

export const ownerPlayers: Translation<OwnerPlayersMsgs> = {
  entryLead: 'Explore player records by season and manage your owned players.',
  openPlayers: 'View my players',
  menu: 'Player management menu',
  records: 'Player records',
  manage: 'Manage owned players',
  viewRecord: 'View record',
  noOwned: 'You own no players from this season. Development history remains in Player records.',
  retry: 'Retry',
  pickLimit: 'Select all (up to 50)',
  title: 'My players',
  loading: 'Loading…',
  sourceAccount: 'These players are recorded on your account. They look the same on other devices.',
  sourceOffline: "Couldn't reach the server, so these are the players saved on this device.",
  sourceDeviceWeb:
    'These players are saved on this device. Link a Google account to see them all in one place.',
  sourceDeviceApp: 'These players are saved on this device. Log in to see them all in one place.',
  seasonGroup: 'Season',
  tagPublic: 'Public',
  openRecord: (p) => `Open ${p.name}'s record`,
  showAll: (p) => `Show all (${p.n})`,
};
