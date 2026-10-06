import type { Translation } from '../core';
import type { TitleTagMsgs } from '../ko/titleTag';

export const titleTag: Translation<TitleTagMsgs> = {
  tagSr: (p) => `${p.rarity} title `,
};
