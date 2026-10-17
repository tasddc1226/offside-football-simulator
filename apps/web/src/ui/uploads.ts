// Loaded with game actions, not the initial shell. Producing a queued record stays synchronous.
import { createUploader } from '@offside/app-core/upload';
import { takePlaySignals } from '../sync/playSignals.js';
import { APP_VERSION } from './helpers.js';
const uploader = createUploader({
  outbox: () => import('../sync/outbox.js'),
  appVersion: APP_VERSION,
  signals: takePlaySignals,
});
export const { uploadSeason, uploadRetirement, uploadLegacyRetirement, enqueueAllSeasons } =
  uploader;

export async function restoreAllSeasons(
  state: Parameters<typeof enqueueAllSeasons>[1],
  eventsOf: Parameters<typeof enqueueAllSeasons>[2],
) {
  enqueueAllSeasons(await import('../sync/outbox.js'), state, eventsOf);
}
