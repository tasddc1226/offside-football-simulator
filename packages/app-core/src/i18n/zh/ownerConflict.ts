import type { Translation } from '../core';
import type { OwnerConflictMsgs } from '../ko/ownerConflict';

export const ownerConflict: Translation<OwnerConflictMsgs> = {
  otherAccount: '這是其他帳號的球員，無法同步到伺服器。用該帳號登入後就會同步。',
  recordedElsewhere: '這段生涯記錄在其他帳號中，請到首頁確認。',
  adopted: '將以目前的帳號繼續記錄。',
};
