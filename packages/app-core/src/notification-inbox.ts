import {
  NotificationListSchema,
  NotificationSchema,
  NotificationReadSchema,
  NotificationReadAllSchema,
  type AppNotification,
} from '@offside/contracts';
import { apiFetch } from './api/client.js';
import { inboxText as L } from './i18n/ko/inbox.js';

export const INBOX_CACHE_MS = 5 * 60_000;
export const initialInboxState = () => ({
  items: [] as AppNotification[],
  detail: null as AppNotification | null,
  nextCursor: null as string | null,
  unreadCount: 0,
  onlyUnread: false,
  loaded: false,
  busy: false,
  error: '',
  revision: 0,
});
export type InboxState = ReturnType<typeof initialInboxState>;

/** 캐시는 현재 세션의 메모리에만 둔다. 계정 변경은 진행 중인 이전 응답도 폐기한다. */
export function createNotificationInbox(state: InboxState) {
  let epoch = 0;
  let lastLoad = 0;
  let pending: Promise<void> | null = null;
  let refreshAfterPending = false;
  let loading = false;
  function reset() {
    epoch++;
    pending = null;
    loading = false;
    lastLoad = 0;
    refreshAfterPending = false;
    const revision = state.revision + 1;
    Object.assign(state, initialInboxState(), { revision });
  }
  function invalidate() {
    lastLoad = 0;
    refreshAfterPending = !!pending;
    state.revision++;
  }
  function run(task: (current: () => boolean) => Promise<void>, isLoad = false) {
    if (pending) return pending;
    const version = epoch;
    loading = isLoad;
    state.busy = true;
    state.error = '';
    const work = task(() => version === epoch)
      .catch(() => {
        if (version === epoch) state.error = L.loadFailed;
      })
      .finally(() => {
        if (version === epoch) {
          state.busy = false;
          pending = null;
          loading = false;
          if (refreshAfterPending) {
            refreshAfterPending = false;
            lastLoad = 0;
            state.revision++;
          }
        }
      });
    pending = work;
    return work;
  }
  function load(
    options: { refresh?: boolean; more?: boolean; unread?: boolean } = {},
  ): Promise<void> {
    if (pending) return loading ? pending : pending.then(() => load(options));
    const unread = options.unread ?? state.onlyUnread;
    const changed = unread !== state.onlyUnread;
    if (
      !options.refresh &&
      !options.more &&
      !changed &&
      state.loaded &&
      Date.now() - lastLoad < INBOX_CACHE_MS
    )
      return Promise.resolve();
    if (options.more && !state.nextCursor) return Promise.resolve();
    if (changed) {
      state.onlyUnread = unread;
      state.items = [];
      state.loaded = false;
      state.nextCursor = null;
    }
    const cursor = options.more ? state.nextCursor : null;
    return run(async (current) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (unread) params.set('unread', '1');
      const query = params.toString();
      const r = await apiFetch<unknown>(`/v1/notifications${query ? `?${query}` : ''}`);
      if (!current()) return;
      if (!r.ok) {
        state.error = r.error.message;
        return;
      }
      const data = NotificationListSchema.parse(r.data);
      const merged = cursor ? [...state.items, ...data.items] : data.items;
      state.items = [...new Map(merged.map((item) => [item.id, item])).values()];
      state.nextCursor = data.nextCursor;
      state.unreadCount = data.unreadCount;
      state.loaded = true;
      lastLoad = Date.now();
    }, true);
  }
  async function open(id: string) {
    if (pending) await pending;
    if (pending) return pending;
    const version = epoch;
    state.detail = null;
    return run(async (current) => {
      const known = state.items.find((item) => item.id === id);
      if (known) state.detail = { ...known };
      else {
        const r = await apiFetch<unknown>(`/v1/notifications/${id}`);
        if (!current()) return;
        if (!r.ok) {
          state.detail = null;
          state.error = r.error.message;
          return;
        }
        state.detail = NotificationSchema.parse(r.data);
      }
    }).then(() => {
      if (version === epoch && state.detail?.id === id) return read(id);
    });
  }
  function read(id: string) {
    if (state.detail?.id === id && state.detail.readAt) return Promise.resolve();
    return run(async (current) => {
      const r = await apiFetch<{ readAt: string }>(`/v1/notifications/${id}/read`, {
        method: 'POST',
      });
      if (!current()) return;
      if (!r.ok) {
        state.error = r.error.message;
        return;
      }
      const { readAt } = NotificationReadSchema.parse(r.data);
      const item = state.items.find((row) => row.id === id);
      const wasUnread = item ? !item.readAt : state.detail?.id === id && !state.detail.readAt;
      if (item) item.readAt = readAt;
      if (state.detail?.id === id) state.detail.readAt = readAt;
      if (wasUnread) state.unreadCount = Math.max(0, state.unreadCount - 1);
      if (state.onlyUnread) state.items = state.items.filter((row) => !row.readAt);
    });
  }
  function readAll() {
    const through = state.items[0]?.createdAt;
    if (!through) return Promise.resolve();
    return run(async (current) => {
      const r = await apiFetch<{ updated: number }>('/v1/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify({ through }),
      });
      if (!current()) return;
      if (!r.ok) {
        state.error = r.error.message;
        return;
      }
      const { updated } = NotificationReadAllSchema.parse(r.data);
      const stamp = new Date().toISOString();
      state.items.forEach((row) => {
        if (!row.readAt && row.createdAt <= through) row.readAt = stamp;
      });
      if (state.detail && !state.detail.readAt && state.detail.createdAt <= through)
        state.detail.readAt = stamp;
      state.unreadCount = Math.max(0, state.unreadCount - updated);
      if (state.onlyUnread) state.items = state.items.filter((row) => !row.readAt);
    });
  }
  return { reset, invalidate, load, open, read, readAll };
}
