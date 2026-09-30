// T-10-013. 다른 계정 소유 커리어 처리 — 판단·기록은 app-core/ownerConflict. 웹은 업로드 큐(지연 로드)의 이벤트를 넘긴다.
import { createOwnerConflicts } from '@offside/app-core/ownerConflict';
import type { OutboxItem } from '../sync/outbox.js';
import { OWNER_CONFLICT_EVENT } from '../sync/syncEvents.js';
import { appState } from './state.svelte.js';
import { enqueueAllSeasons, save, toast } from './helpers.js';

export const { onOwnerConflict, adoptCareer, keepOnDevice } = createOwnerConflicts({
  state: appState,
  save,
  toast,
  enqueueAllSeasons: (G, eventsOf) =>
    void import('../sync/outbox.js').then((m) => enqueueAllSeasons(m, G, eventsOf)),
});

export function watchOwnerConflicts() {
  window.addEventListener(OWNER_CONFLICT_EVENT, (e) =>
    onOwnerConflict((e as CustomEvent<OutboxItem[]>).detail),
  );
}
