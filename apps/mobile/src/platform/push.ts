import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { proxy } from 'valtio';
import { apiFetch } from '@offside/app-core/api/client';
import { createPushRegistration } from '@offside/app-core/pushRegistration';
import { ensureSession, onSessionChanged, sessionToken } from './session';
import { kv } from './setup';
import { openBoard } from '../game/nav';

const DEVICE_KEY = 'offside_push_installation';
const WANTED = 'offside_push_wanted';
const REMOVE = 'offside_push_remove';
const REGISTERED = 'offside_push_registered';
export const pushState = proxy({
  enabled: kv.getBoolean(WANTED) ?? false,
  busy: false,
  blocked: false,
  message: '',
  failed: false,
});
let identity: Promise<string> | undefined;
async function installationId() {
  identity ??= (async () => {
    const previous = await SecureStore.getItemAsync(DEVICE_KEY);
    if (previous) return previous;
    const next = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_KEY, next);
    return next;
  })().catch((e) => {
    identity = undefined;
    throw e;
  });
  return identity;
}
let expoToken: { token: string; until: number } | undefined;
async function register() {
  const appVersion = Constants.expoConfig?.version;
  if (!appVersion || !/^\d+\.\d+\.\d+$/.test(appVersion)) throw new Error('No app version');
  if (!(await ensureSession())) throw new Error('No app session');
  if (!expoToken || expoToken.until < Date.now()) {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('No EAS project');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    expoToken = { token, until: Date.now() + 3_600_000 };
  }
  const fingerprint = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${expoToken.token}|${sessionToken()}|${appVersion}`,
  );
  const saved = kv.getString(REGISTERED);
  if (saved === fingerprint && Date.now() - (kv.getNumber(`${REGISTERED}_at`) ?? 0) < 86400_000)
    return;
  const r = await apiFetch('/v1/push/device', {
    method: 'PUT',
    body: JSON.stringify({
      installationId: await installationId(),
      token: expoToken.token,
      platform: Platform.OS,
      appVersion,
    }),
  });
  if (!r.ok) throw new Error('Could not register device');
  kv.set(REGISTERED, fingerprint);
  kv.set(`${REGISTERED}_at`, Date.now());
}
export const pushRegistration = createPushRegistration(pushState, {
  wanted: () => kv.getBoolean(WANTED) ?? false,
  saveWanted: (on) => kv.set(WANTED, on),
  pendingRemoval: () => kv.getBoolean(REMOVE) ?? false,
  savePendingRemoval: (on) => kv.set(REMOVE, on),
  async permission(request) {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'blocked';
    if (request && Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('news', {
        name: '공지·릴리즈 노트',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    let status = await Notifications.getPermissionsAsync();
    if (!status.granted && status.canAskAgain && request)
      status = await Notifications.requestPermissionsAsync();
    return status.granted ? 'granted' : status.canAskAgain ? 'denied' : 'blocked';
  },
  register,
  async unregister() {
    if (!(await ensureSession())) throw new Error('No app session');
    const r = await apiFetch('/v1/push/device', {
      method: 'DELETE',
      body: JSON.stringify({ installationId: await installationId() }),
    });
    if (!r.ok) throw new Error('Could not remove device');
    kv.remove(REGISTERED);
  },
});

/** 허용된 게시판 데이터만 연다. 푸시에서 임의 URL이나 게임 명령을 실행하지 않는다. */
function openNotification(response: Notifications.NotificationResponse) {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const data = response.notification.request.content.data;
  if (
    !data ||
    data.type !== 'offside-news' ||
    (data.board !== 'notice' && data.board !== 'release')
  )
    return;
  const postId =
    typeof data.postId === 'string' && /^pst_[A-Za-z0-9_-]{1,80}$/.test(data.postId)
      ? data.postId
      : null;
  openBoard(data.board, postId);
}
let started = false;
export function startPush() {
  if (started) return;
  started = true;
  // 켜진 앱에는 기존 게임 내 배너가 있어 OS 배너·소리를 중복해서 내지 않는다.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldShowBanner: notification.request.content.data?.test === true,
      shouldShowList: notification.request.content.data?.test === true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    openNotification(last);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }
  Notifications.addNotificationResponseReceivedListener((response) => {
    openNotification(response);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  });
  Notifications.addPushTokenListener(() => {
    expoToken = undefined;
    kv.remove(REGISTERED);
    void pushRegistration.restore();
  });
  onSessionChanged(() => {
    void pushRegistration.restore();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void pushRegistration.restore();
  });
  void pushRegistration.restore();
}

export async function testOwnPush() {
  if (!pushState.enabled) throw new Error('먼저 알림 받기를 켜 주세요.');
  const r = await apiFetch('/v1/push/test', {
    method: 'POST',
    body: JSON.stringify({ installationId: await installationId() }),
  });
  if (!r.ok) throw new Error(r.error.message);
}
