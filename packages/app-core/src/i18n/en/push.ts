import type { Translation } from '../core';
import type { PushMsgs } from '../ko/push';

export const push: Translation<PushMsgs> = {
  title: 'News notifications',
  body: 'Get notified about new announcements and release notes. We send at most one a day per board.',
  tokenNote: 'To connect notifications, we store your push token, device type and app version.',
  offLabel: 'Turn off news notifications on this device',
  onLabel: 'Turn on news notifications on this device',
  busy: 'Setting up notifications…',
  turnOff: 'Turn off notifications',
  turnOn: 'Turn on notifications',
  openSettings: 'Open device notification settings',
  reconnect: 'Reconnect',
  testNote:
    'Test notifications are sent to this device only. You can request one every 10 minutes per device and account, up to 3 a day.',
  engagementTitle: 'Comeback reminders (optional)',
  engagementBody:
    "Get a nudge to pick up where you left off if you haven't visited for 7 days or more. Sent only between 9 AM and 8 PM.",
  engagementOff: 'Turn off comeback reminders',
  engagementOn: 'Get comeback reminders',
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
};
