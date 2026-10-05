import type { Translation } from '../core';
import type { AccountMsgs } from '../ko/account';

export const account: Translation<AccountMsgs> = {
  title: 'Account',
  checking: 'Checking…',
  errorTitle: "Can't connect",
  errorBody:
    "Couldn't reach the server to check your login status. You can keep playing, and your progress is saved on this device.",
  retry: 'Try again',
  guestTitle: "You're not logged in",
  guestBody:
    'Your progress is saved only on this device. Log in to see your player records and club name on other devices.',
  logout: 'Log out',
  cancel: 'Cancel',
  logoutTitle: 'Log out?',
  logoutBodyWeb:
    'Your game progress on this device stays. Log in with the same Google account again to see your saved records.',
  logoutBodyApp:
    'Your game progress on this device stays. Log in with the same account again to see your saved records.',
  nickname: 'Comment nickname',
  nicknamePrompt: 'Pick a comment nickname to post on the news board',
  nicknameFixed: (p) => `${p.nickname} · Admin accounts are fixed`,
  unlinkGoogle: 'Unlink Google',
  deleteAccount: 'Delete account',
  deleteBody:
    "Delete your account and the player records, teams, comments and chat saved on the server? This can't be undone. Game progress on this device stays.",
  deleteConfirm: 'Delete',
  googleTitle: 'Google account',
  googleVia: 'You logged in with your Google account.',
  appleTitle: 'Apple account',
  appleVia: 'You logged in with your Apple account.',
  loginGoogle: 'Log in with Google',
  googleFinishFail: "Couldn't finish Google login. Please try again.",
  appleStartFail: "Couldn't start Apple login.",
  appleFinishFail: "Couldn't finish Apple login. Please try again.",
  viaGoogle: 'Google',
  viaApple: 'Apple',
};
