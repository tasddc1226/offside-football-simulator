import type { Translation } from '../core';
import type { RetiredLookMsgs } from '../ko/retiredLook';

export const retiredLook: Translation<RetiredLookMsgs> = {
  title: 'Customize retired player',
  intro: 'Basic customization is free. Records, attributes and player funds stay unchanged.',
  recordNote: 'Record items are available when their stored title requirements are met.',
  retiredPreview: 'Retirement look',
  kitPreview: 'Player card look',
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
