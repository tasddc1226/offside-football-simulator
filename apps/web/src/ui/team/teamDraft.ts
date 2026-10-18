import { createTeamDraftStore } from '@offside/app-core/teamDraft';

export { teamDraftBase, type TeamDraft } from '@offside/app-core/teamDraft';

// Tab-scoped storage. Keep global access inside the callbacks for SSR/fallback safety.
export const { readTeamDraft, writeTeamDraft } = createTeamDraftStore({
  get: (key) => sessionStorage.getItem(key),
  set: (key, value) => sessionStorage.setItem(key, value),
  remove: (key) => sessionStorage.removeItem(key),
});
