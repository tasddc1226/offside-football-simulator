import { proxy } from 'valtio';
import { apiFetch } from '@offside/app-core/api/client';
import {
  DEFAULT_PUSH_TOPIC_PREFERENCES,
  PushTopicPreferencesSchema,
  type PushTopic,
  type PushTopicPreferences,
} from '@offside/contracts';
import { topicsFromLegacy } from '@offside/app-core/pushTopics';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { ensureSession, onSessionChanged, sessionToken } from './session';

export const pushPreferencesState = proxy({
  values: { ...DEFAULT_PUSH_TOPIC_PREFERENCES },
  loaded: false,
  loading: false,
  saving: null as PushTopic | null,
  error: '',
  sessionRevision: 0,
});
let revision = 0;
// 주제(10개) 모양은 `?v=2`로 물어야 온다. 배포 순서로 서버가 아직 옛 모양을 주면 옛 설정을 주제로 펴서 읽는다.
const PATH = '/v1/push/preferences?v=2';
const parse = (data: unknown): PushTopicPreferences => {
  const topics = PushTopicPreferencesSchema.safeParse(data);
  return topics.success ? topics.data : topicsFromLegacy((data ?? {}) as Record<string, boolean>);
};
let pending: Promise<void> | undefined;
onSessionChanged(() => {
  revision++;
  pending = undefined;
  Object.assign(pushPreferencesState, {
    values: { ...DEFAULT_PUSH_TOPIC_PREFERENCES },
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
    pushPreferencesState.error = L.prefsConnectFailed;
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
      const result = await apiFetch<unknown>(PATH);
      if (current !== revision || token !== sessionToken()) return;
      if (!result.ok) throw new Error(result.error.message);
      pushPreferencesState.values = parse(result.data);
      pushPreferencesState.loaded = true;
    } catch (error) {
      if (current === revision)
        pushPreferencesState.error = error instanceof Error ? error.message : L.prefsLoadFailed;
    } finally {
      if (current === revision) {
        pushPreferencesState.loading = false;
        pending = undefined;
      }
    }
  })();
  return pending;
}

export async function setPushPreference(key: PushTopic, enabled: boolean) {
  if (!pushPreferencesState.loaded || pushPreferencesState.loading || pushPreferencesState.saving)
    return;
  const before = pushPreferencesState.values[key];
  const current = revision;
  const token = sessionToken();
  pushPreferencesState.values[key] = enabled;
  pushPreferencesState.saving = key;
  pushPreferencesState.error = '';
  try {
    const result = await apiFetch<unknown>(PATH, {
      method: 'PUT',
      body: JSON.stringify({ [key]: enabled }),
    });
    if (current !== revision || token !== sessionToken()) return;
    if (!result.ok) throw new Error(result.error.message);
    pushPreferencesState.values = parse(result.data);
  } catch (error) {
    if (current === revision) {
      pushPreferencesState.values[key] = before;
      pushPreferencesState.error = error instanceof Error ? error.message : L.prefsSaveFailed;
    }
  } finally {
    if (current === revision) pushPreferencesState.saving = null;
  }
}

/** 선택 창에서 고른 주제를 요청 하나로 저장한다. 성공하면 true. */
export async function savePushTopics(topics: PushTopicPreferences): Promise<boolean> {
  if (!(await ensureSession())) return false;
  const current = revision;
  const token = sessionToken();
  try {
    const result = await apiFetch<unknown>(PATH, { method: 'PUT', body: JSON.stringify(topics) });
    if (!result.ok) return false;
    if (current === revision && token === sessionToken()) {
      pushPreferencesState.values = parse(result.data);
      pushPreferencesState.loaded = true;
    }
    return true;
  } catch {
    return false;
  }
}
