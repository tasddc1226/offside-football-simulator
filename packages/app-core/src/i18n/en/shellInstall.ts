import type { Translation } from '../core';
import type { ShellInstallMsgs } from '../ko/shellInstall';

export const shellInstall: Translation<ShellInstallMsgs> = {
  inappHint:
    "You're in an in-app browser (KakaoTalk, Instagram and the like). Your records are only saved inside this app. Open it in your regular browser for safer sign-in and saving.",
  inappHintAria: 'Open in your regular browser',
  inappOpen: 'Open in browser',
  inappClose: 'Dismiss',
  manualIos: "Tap the ··· (or Share) menu and choose 'Open in Safari'.",
  manualAndroid: "Tap the ··· (or ⋮) menu and choose 'Open in another browser'.",
  manualCopied: (p) =>
    `${p.menu} The address is copied, so you can also paste it into your browser's address bar.`,
  openTitle: 'Please open this in your browser',
  gotIt: 'Got it',
  loginNoticeTitle: 'Please sign in from your browser',
  loginNoticeBody:
    'Google blocks sign-in inside in-app browsers (KakaoTalk, Instagram and the like). Open this in your regular browser to sign in.',
  close: 'Close',
  promoTileTitle: 'iPhone app ↗',
  promoTileSub: 'Get OFFSIDE on the App Store',
  promoSheetTitle: 'Keep playing in the iPhone app',
  promoSheetText:
    "In the app your records aren't wiped if you stay away for a while, and you get news as notifications. Move a career in progress to the app with the backup code in Settings.",
  promoSheetStore: 'Get it on the App Store',
  promoSheetHomeScreen: "I'll add it to my home screen",
  promoMoveTitle: 'Move to the iPhone app',
  promoMoveStep1: 'Get OFFSIDE on the App Store.',
  promoMoveStep2:
    'Sign in with the same Google account on the app’s Owner screen to carry over your Hall of Fame and club records.',
  promoMoveStep3:
    'For a career in progress, copy the backup code below and paste it into Backup in the app’s Settings.',
};
