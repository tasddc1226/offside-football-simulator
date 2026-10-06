import type { Translation } from '../core';
import type { PushMsgs } from '../ko/push';

export const push: Translation<PushMsgs> = {
  title: 'Receive app notifications',
  body: 'Turn all notifications on this device on or off.',
  tokenNote:
    'To connect notifications, we store your push token, device type and app version. Delivery results, notification taps and the screens they open are kept on our server for 90 days to run the service.',
  busy: 'Setting up notifications…',
  openSettings: 'Open device notification settings',
  reconnect: 'Reconnect',
  testNote:
    'Test notifications are sent to this device only. You can request one every 10 minutes per device and account, up to 3 a day.',
  openInbox: 'Open inbox',
  testBusy: 'Requesting…',
  testBtn: 'Send a test notification to my device',
  nextTest: 'Next test:',
  testRequested:
    'Test notification requested. Check your device notification center to confirm it arrived.',
  testFailed: "Couldn't send the test request.",
  privacy: 'How notification data is handled',
  channelName: 'Announcements and release notes',
  errTurnOnFirst: 'Turn on notifications first.',
  errTestWait: 'You can send another test notification in a moment.',
  offDone: 'News notifications are off on this device.',
  needSettings: 'Allow notifications in your device settings.',
  denied: 'Notifications were not allowed.',
  onDone: 'News notifications are on for this device.',
  offLocal:
    "Turned off on this device. We'll retry disconnecting from the server once you're back online.",
  connectFail: "Couldn't connect notifications. Please try again in a moment.",
  prefsNote:
    'Category choices are saved to your account and stay as they are even if you turn all notifications off.',
  prefsLoading: 'Loading notification types…',
  prefsReload: 'Reload notification types',
  catNotice: 'Announcements',
  catNoticeBody: 'Service announcements and events',
  catRelease: 'Updates',
  catReleaseBody: 'New versions and features',
  catTeam: 'My team',
  catTeamBody: 'Results of matches others play against you',
  catMarket: 'Transfer market',
  catMarketBody: 'When a player you listed is sold',
  catSocial: 'Friends',
  catSocialBody: 'Friend requests, accepts and friendly results',
  catAria: (p) => `${p.title} notifications`,
  prefsConnectFailed: "Couldn't connect to notification settings. Please try again.",
  prefsLoadFailed: "Couldn't load notification settings.",
  prefsSaveFailed: "Couldn't save notification settings.",
};
