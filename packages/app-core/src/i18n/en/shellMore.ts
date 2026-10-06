import type { Translation } from '../core';
import type { ShellMoreMsgs } from '../ko/shellMore';

export const shellMore: Translation<ShellMoreMsgs> = {
  navIntroGame: 'This is the game menu. Use the Home button in the middle to leave.',
  navIntroTeam: 'This is the My team menu. Use the Owner button in the middle to leave.',
  back: '← Back',
  close: 'Close',
  retry: 'Try again',
  adLabel: 'Ad',
  adPreview: (p) => `Ad slot · ${p.place}`,
  updateBodyApp: 'A new version is out. Restart to apply it.',
  updateBtnApp: 'Restart',
  storeUpdateAlert: 'App update alert',
  storeUpdateTitle: 'A new version is in the store',
  storeUpdateBody: "Without updating, later fixes won't reach this app.",
  storeUpdateBtn: 'Update',
  keepLoginTitle: 'Sign in to keep your records',
  keepLoginBody:
    'Sign in to see your retirement records on other devices. You can create share links without signing in.',
  keepLoginGoogle: 'Sign in with Google',
  storeUnavailable: "The store can't be opened on this device.",
};
