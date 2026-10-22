import type { Translation } from '../core';
import type { RetiredLookMsgs } from '../ko/retiredLook';

export const retiredLook: Translation<RetiredLookMsgs> = {
  title: 'Customize retired player',
  button: 'Customize (1x)',
  buttonUsed: 'Customize (used)',
  buttonTransferred: 'Customize unavailable',
  intro: 'Basic customization is free. Records, attributes and player funds stay unchanged.',
  policy:
    "You can change a retired player's appearance once for free. Players traded on the transfer market cannot change appearance.",
  used: 'This player has already used their appearance change for the new player art.',
  transferred: 'This player was traded on the transfer market, so the appearance cannot change.',
  checking: 'Checking availability',
  checkFailed: 'Could not check availability. Close and reopen to try again.',
  localPartial:
    'Appearance and its one-time limit were saved on this device, but the record view could not be updated. Reopen to check.',
  recordNote: 'Record items are available when their stored title requirements are met.',
  retiredPreview: 'Retirement look',
  kitPreview: 'Player card look',
  confirm: 'Confirm appearance',
  confirmTitle: 'Confirm this appearance?',
  confirmNote:
    "Once confirmed, this player's appearance cannot be changed again. Records and stats stay the same.",
  back: 'Keep editing',
  save: 'Save appearance',
  saving: 'Saving',
  cancel: 'Cancel',
  reset: 'Default look',
  saved: 'Appearance saved. Records and attributes are unchanged.',
  localSaved: 'Appearance saved on this device. This retired career has no server record.',
  serverSaved: 'Appearance saved on the server, but device storage failed. Reopen to check.',
  storageFailed: 'Could not save on this device. Please check available storage.',
  failed: 'Could not save appearance. Please try again.',
};
