import { createTeamDraftStore } from '@offside/app-core/teamDraft';
import { kv } from '../../platform/setup';

export { teamDraftBase, type TeamDraft } from '@offside/app-core/teamDraft';

// Device-persistent storage, independent of the game save.
export const { readTeamDraft, writeTeamDraft } = createTeamDraftStore({
  get: (key) => kv.getString(key),
  set: (key, value) => kv.set(key, value),
  remove: (key) => kv.remove(key),
});
