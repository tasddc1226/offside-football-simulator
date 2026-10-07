import type { Translation } from '../core';
import type { SettingsApiMsgs } from '../ko/settingsApi';

export const settingsApi: Translation<SettingsApiMsgs> = {
  network: 'サーバーに接続できませんでした。',
  badResponse: 'サーバーの応答を読み取れませんでした。',
  failed: 'リクエストを処理できませんでした。',
  failedStatus: (p) => `リクエストを処理できませんでした（${p.status}）。`,
  badShape: 'サーバーの応答の形式が正しくありません。',
};
