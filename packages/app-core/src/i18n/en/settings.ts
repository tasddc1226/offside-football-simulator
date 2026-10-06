import type { Translation } from '../core';
import type { SettingsMsgs } from '../ko/settings';

export const settings: Translation<SettingsMsgs> = {
  title: 'Settings',
  darkTitle: 'Dark mode',
  darkBodyWeb: 'Switch to a dark screen. Saved on this device.',
  darkBodyApp: 'Use a dark screen. Saved on this device.',
  langTitle: 'Language',
  langBody:
    'Changes the language of menus and buttons. Event and record text is still in Korean for now. Saved on this device.',
  sheetTitle: 'Work mode',
  sheetBodyBefore: 'Turns the game into a spreadsheet and mutes sound. Press ',
  sheetBodyAfter: ' (the key left of 1) to toggle. PC browsers only. Saved on this device.',
  sfxTitle: 'Sound effects',
  sfxBody: 'Play a click when you tap a button.',
  bgmTitle: 'Music',
  bgmBody:
    'Records and player pages play a different track. You can also toggle it with the speaker button at the top.',
  bgmVolume: 'Music volume',
  bgmVolumeNote: "On this device, use your device's volume buttons to set the music volume.",
  musicCredit: 'Music:',
  namePublicTitle: 'Show player name',
  namePublicBody:
    "Your player's name appears in Home live, the Hall of Fame and server firsts. Turn it off to show something like 'An anonymous striker' from next season's records. Avoid using real names.",
  analyticsTitle: 'App analytics (optional)',
  analyticsBody:
    'If you agree, Google Analytics measures screen visits, career start, progress and retirement, plus device, app version and session info. Player names, account details and save files are never sent. You can turn it off anytime, and nothing is sent before you agree.',
  help: 'Help',
  installGuide: 'Add to home screen',
  guide: 'Game guide',
  faq: 'FAQ',
  legal: 'Policies',
  terms: 'Terms of service',
  privacy: 'Privacy policy',
  tapToChange: 'Tap to change',
  close: 'Close',
  consentAria: 'Optional usage analytics',
  consentTitle: 'Usage analytics to improve the game',
  consentOptional: '(optional)',
  consentBody1:
    'If you agree, Google Analytics uses cookies to analyse how you arrive, screen navigation, and use of career start, season complete, retirement and share buttons. Names and career IDs are not sent. The game works the same if you decline.',
  consentBody2:
    "Analytics data is processed on Google's overseas servers, and user and event data is kept for 2 months. You can change this anytime in Settings.",
  consentMore: 'Learn more',
  consentNow: 'Current:',
  consentGranted: 'Agreed',
  consentDenied: 'Declined',
  consentUnset: 'Not chosen yet',
  consentRevoke: 'Withdraw analytics consent',
  consentAgree: 'Agree to analytics',
  consentRevokeNote:
    "If you withdraw, collection stops and this browser's analytics cookies and records are cleared. Data already sent is not deleted automatically.",
  reviewTitle: 'Store review',
  reviewBody: 'Tell others what you think of the game on the store.',
  reviewOpening: 'Opening the store…',
  reviewBtn: 'Leave a store review',
  reviewFail: "Couldn't open the store. Please try again in a moment.",
};
