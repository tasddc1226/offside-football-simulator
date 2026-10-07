import type { Translation } from '../core';
import type { OwnerConflictMsgs } from '../ko/ownerConflict';

export const ownerConflict: Translation<OwnerConflictMsgs> = {
  otherAccount:
    '別のアカウントの選手なので、サーバーに反映できませんでした。そのアカウントでログインすると反映されます。',
  recordedElsewhere: 'このキャリアは別のアカウントに記録されています。ホームで確認してください。',
  adopted: '今のアカウントで続けて記録します。',
};
