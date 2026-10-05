import type { Translation } from '../core';
import type { OwnerConflictMsgs } from '../ko/ownerConflict';

export const ownerConflict: Translation<OwnerConflictMsgs> = {
  otherAccount:
    "This player belongs to another account, so we couldn't save it to the server. Log in with that account to save it.",
  recordedElsewhere: 'This career is recorded under another account. Check it on Home.',
  adopted: "We'll keep recording under your current account.",
};
