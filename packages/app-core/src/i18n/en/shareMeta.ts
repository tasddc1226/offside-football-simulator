import type { Translation } from '../core';
import type { ShareMetaMsgs } from '../ko/shareMeta';

export const shareMeta: Translation<ShareMetaMsgs> = {
  title: (p) => `${p.who} · ${p.band} (Legend ${p.score} pts)`,
  description: (p) =>
    `Retired at ${p.age} · ${p.apps} matches, ${p.goals} goals, ${p.assists} assists · ${p.trophies} trophies`,
  club: (p) => ` · Last club ${p.club}`,
};
