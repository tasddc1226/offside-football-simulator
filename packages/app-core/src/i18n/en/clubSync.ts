import type { Translation } from '../core';
import type { ClubSyncMsgs } from '../ko/clubSync';

export const clubSync: Translation<ClubSyncMsgs> = {
  syncLocal: 'Saved on this device only. Sign in with Google to sync with your other devices.',
  syncSyncing: 'Syncing with your account…',
  syncSynced: 'Saved to your account. It also applies on devices signed in with the same account.',
  syncError: "Couldn't sync. Saved on this device, and we'll try again later.",
  syncFull:
    'There are too many emblem images to sync with your account. Saved on this device. Remove a few images to sync again.',
};
