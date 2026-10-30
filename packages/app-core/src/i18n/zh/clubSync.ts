import type { Translation } from '../core';
import type { ClubSyncMsgs } from '../ko/clubSync';

export const clubSync: Translation<ClubSyncMsgs> = {
  syncLocal: '只會儲存在這台裝置。用 Google 帳號登入後，就能和其他裝置同步。',
  syncSyncing: '正在與帳號同步…',
  syncSynced: '已儲存到帳號。用同一個帳號登入的裝置也能使用。',
  syncError: '同步失敗。已儲存在這台裝置，下次會再試一次。',
  syncFull: '隊徽圖片太多，無法與帳號同步。已儲存在這台裝置。刪除幾張圖片後就會再次同步。',
};
