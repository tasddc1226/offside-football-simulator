import type { Translation } from '../core';
import type { LegendToastMsgs } from '../ko/legendToast';

export const legendToast: Translation<LegendToastMsgs> = {
  detailFailed: "Couldn't load the full record.",
  nameBlocked: "Names with links or profanity can't be made public. It will stay anonymous.",
  namePublished: 'Your name is now public in the Hall of Fame.',
  nameAnon: 'Switched to anonymous in the Hall of Fame.',
};
