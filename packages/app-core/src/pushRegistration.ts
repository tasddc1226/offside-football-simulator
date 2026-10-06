import { pushText as L } from './i18n/ko/push.js';

/** 네이티브 권한·토큰 API는 앱이 넣는다. 거절·오프라인·계정 전환을 UI와 분리해 검증한다. */
export type PushRegistrationState = {
  enabled: boolean;
  busy: boolean;
  message: string;
  blocked: boolean;
  failed: boolean;
};
export type PushRegistrationIO = {
  wanted: () => boolean;
  saveWanted: (on: boolean) => void;
  permission: (request: boolean) => Promise<'granted' | 'denied' | 'blocked'>;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  pendingRemoval: () => boolean;
  savePendingRemoval: (pending: boolean) => void;
};
export function createPushRegistration(state: PushRegistrationState, io: PushRegistrationIO) {
  let restoreQueued = false;
  async function restore() {
    if (state.busy) {
      restoreQueued = true;
      return;
    }
    if (io.wanted()) await setEnabled(true, false);
    else if (io.pendingRemoval()) await setEnabled(false, false);
  }
  async function remove() {
    io.savePendingRemoval(true);
    await io.unregister();
    io.savePendingRemoval(false);
  }
  async function setEnabled(on: boolean, request = true) {
    if (state.busy) return;
    state.busy = true;
    state.message = '';
    state.failed = false;
    try {
      if (!on) {
        state.enabled = false;
        io.saveWanted(false);
        await remove();
        state.message = L.offDone;
        return;
      }
      const permission = await io.permission(request);
      state.blocked = permission === 'blocked';
      if (permission !== 'granted') {
        state.enabled = false;
        io.saveWanted(false);
        if (io.pendingRemoval() || !request) await remove();
        state.message = state.blocked ? L.needSettings : L.denied;
        return;
      }
      await io.register();
      io.savePendingRemoval(false);
      io.saveWanted(true);
      state.enabled = true;
      state.message = L.onDone;
    } catch {
      state.failed = true;
      state.message = !on || io.pendingRemoval() ? L.offLocal : L.connectFail;
    } finally {
      state.busy = false;
      if (restoreQueued) {
        restoreQueued = false;
        await restore();
      }
    }
  }
  return {
    setEnabled,
    restore,
  };
}
