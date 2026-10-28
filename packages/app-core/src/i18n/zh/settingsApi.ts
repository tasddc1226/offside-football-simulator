import type { Translation } from '../core';
import type { SettingsApiMsgs } from '../ko/settingsApi';

export const settingsApi: Translation<SettingsApiMsgs> = {
  network: '無法連線到伺服器。',
  badResponse: '無法讀取伺服器回應。',
  failed: '無法處理請求。',
  failedStatus: (p) => `無法處理請求（${p.status}）。`,
  badShape: '伺服器回應格式不正確。',
};
