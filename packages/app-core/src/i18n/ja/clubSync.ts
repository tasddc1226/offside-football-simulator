import type { Translation } from '../core';
import type { ClubSyncMsgs } from '../ko/clubSync';

export const clubSync: Translation<ClubSyncMsgs> = {
  syncLocal:
    'この端末にだけ保存されます。Googleアカウントでログインすると、ほかの端末と同期されます。',
  syncSyncing: 'アカウントと同期中…',
  syncSynced: 'アカウントに保存しました。同じアカウントでログインした端末でも使われます。',
  syncError: '同期できませんでした。この端末には保存済みで、次回また試します。',
  syncFull:
    'エンブレム画像が多すぎてアカウントと同期できません。この端末には保存しました。画像をいくつか削除すると、また同期されます。',
};
