import type { Translation } from '../core';
import type { RetiredLookMsgs } from '../ko/retiredLook';

export const retiredLook: Translation<RetiredLookMsgs> = {
  title: 'Customize retired player',
  intro: 'Basic customization is free. Records, attributes and player funds stay unchanged.',
  policy:
    'Appearance can be changed once after retirement. Saving is final. Players with any transfer history cannot change appearance.',
  used: 'This player has already used their one appearance change after retirement.',
  transferred: 'Players who have transferred cannot change appearance, even after returning.',
  checking: 'Checking availability',
  checkFailed: 'Could not check availability. Close and reopen to try again.',
  localPartial:
    'Appearance and its one-time limit were saved on this device, but the record view could not be updated. Reopen to check.',
  recordNote: 'Record items are available when their stored title requirements are met.',
  retiredPreview: 'Retirement look',
  kitPreview: 'Player card look',
  confirm: 'Confirm appearance',
  confirmNote: 'Saving uses the one available change. Confirm this appearance?',
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
