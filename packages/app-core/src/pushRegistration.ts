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
        state.message = '이 기기의 새 소식 알림을 껐어요.';
        return;
      }
      const permission = await io.permission(request);
      state.blocked = permission === 'blocked';
      if (permission !== 'granted') {
        state.enabled = false;
        io.saveWanted(false);
        if (io.pendingRemoval() || !request) await remove();
        state.message = state.blocked
          ? '기기 설정에서 알림을 허용해 주세요.'
          : '알림을 허용하지 않았어요.';
        return;
      }
      await io.register();
      io.savePendingRemoval(false);
      io.saveWanted(true);
      state.enabled = true;
      state.message = '이 기기의 알림 연결을 준비했어요.';
    } catch {
      state.failed = true;
      state.message =
        !on || io.pendingRemoval()
          ? '이 기기에서는 껐어요. 서버 연결 해제는 연결이 돌아오면 다시 시도해요.'
          : '알림을 연결하지 못했어요. 잠시 뒤 다시 연결해 주세요.';
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
