import { fileURLToPath } from 'node:url';

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/ui/scroll.test.mjs',
      'src/platform/push.test.mjs',
      'src/platform/pushTracking.test.mjs',
      'src/platform/pushPreferences.test.mjs',
      'src/platform/engagement.test.mjs',
      'src/platform/pushAsk.test.mjs',
      'src/platform/chatUnread.test.mjs',
      'src/platform/rewarded.test.mjs',
      'src/platform/interstitial.test.mjs',
      'src/platform/iapItems.test.mjs',
      'src/platform/playSignals.test.mjs',
    ],
  },
};
