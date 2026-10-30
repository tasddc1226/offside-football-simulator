import type { Translation } from '../core';
import type { ShellLoginMsgs } from '../ko/shellLogin';

export const shellLogin: Translation<ShellLoginMsgs> = {
  failSession: '登入尚未準備好，請再點一次。',
  failRateLimited: '登入嘗試次數過多，請稍後再試。',
  failUnavailable: '目前無法使用 Google 登入，請稍後再試。',
  failCancelled: '已取消登入。',
  offline: '無法連線到伺服器，請稍後再登入。',
  failGeneric: (p) => `Google 登入失敗${p.reason ? `（${p.reason}）` : ''}。`,
  providerGoogle: 'Google',
  failUnavailableApple: '目前無法使用 Apple 登入，請稍後再試。',
  failGenericApple: (p) => `Apple 登入失敗${p.reason ? `（${p.reason}）` : ''}。`,
  linked: (p) => `已連結 ${p.via} 帳號。`,
  switched: (p) => `已切換到另一個 ${p.via} 帳號。`,
};
