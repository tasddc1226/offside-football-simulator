import { proxy } from 'valtio';
import { apiFetch } from '@offside/app-core/api/client';
import {
  DEFAULT_PUSH_PREFERENCES,
  PushPreferencesSchema,
  type PushPreferences,
} from '@offside/contracts';
import { ensureSession, onSessionChanged, sessionToken } from './session';

export const pushPreferencesState = proxy({
  values: { ...DEFAULT_PUSH_PREFERENCES },
  loaded: false,
  loading: false,
  saving: null as keyof PushPreferences | null,
  error: '',
  sessionRevision: 0,
});
let revision = 0;
let pending: Promise<void> | undefined;
onSessionChanged(() => {
  revision++;
  pending = undefined;
  Object.assign(pushPreferencesState, {
    values: { ...DEFAULT_PUSH_PREFERENCES },
    loaded: false,
    loading: false,
    saving: null,
    error: '',
    sessionRevision: revision,
  });
});

/** 설정을 열 때만 조회하고 같은 세션에서는 다시 읽지 않는다. */
export async function loadPushPreferences() {
  if (!(await ensureSession())) {
    pushPreferencesState.error = '알림 설정에 연결하지 못했어요. 다시 시도해 주세요.';
    return;
  }
  if (pushPreferencesState.loaded) return;
  if (pending) return pending;
  const current = revision;
  const token = sessionToken();
  pushPreferencesState.loading = true;
  pushPreferencesState.error = '';
  pending = (async () => {
    try {
      const result = await apiFetch<PushPreferences>('/v1/push/preferences');
      if (current !== revision || token !== sessionToken()) return;
      if (!result.ok) throw new Error(result.error.message);
      pushPreferencesState.values = PushPreferencesSchema.parse(result.data);
      pushPreferencesState.loaded = true;
    } catch (error) {
      if (current === revision)
        pushPreferencesState.error =
          error instanceof Error ? error.message : '알림 설정을 불러오지 못했어요.';
    } finally {
      if (current === revision) {
        pushPreferencesState.loading = false;
        pending = undefined;
      }
    }
  })();
  return pending;
}

export async function setPushPreference(key: keyof PushPreferences, enabled: boolean) {
  if (!pushPreferencesState.loaded || pushPreferencesState.loading || pushPreferencesState.saving)
    return;
  const before = pushPreferencesState.values[key];
  const current = revision;
  const token = sessionToken();
  pushPreferencesState.values[key] = enabled;
  pushPreferencesState.saving = key;
  pushPreferencesState.error = '';
  try {
    const result = await apiFetch<PushPreferences>('/v1/push/preferences', {
      method: 'PUT',
      body: JSON.stringify({ [key]: enabled }),
    });
    if (current !== revision || token !== sessionToken()) return;
    if (!result.ok) throw new Error(result.error.message);
    pushPreferencesState.values = PushPreferencesSchema.parse(result.data);
  } catch (error) {
    if (current === revision) {
      pushPreferencesState.values[key] = before;
      pushPreferencesState.error =
        error instanceof Error ? error.message : '알림 설정을 저장하지 못했어요.';
    }
  } finally {
    if (current === revision) pushPreferencesState.saving = null;
  }
}
