import type { Translation } from '../core';
import type { GamePrimeMsgs } from '../ko/gamePrime';

export const gamePrime: Translation<GamePrimeMsgs> = {
  title: 'Extend Prime',
  rolling: 'Extending…',
  stepsLabel: (p) => `Level ${p.lv} of ${p.max}`,
  lineReady: (p) =>
    `Stats start dropping after the age-${p.peak} season. Succeed and you hold on until ${p.next} (${p.chance}% · ${p.cost}).`,
  lineShort: (p) =>
    `Stats start dropping after the age-${p.peak} season. The next try needs ${p.cost}.`,
  lineDone: (p) =>
    `You have tried this season. Stats start dropping after the age-${p.peak} season.`,
  lineMax: (p) => `Prime fully extended. Stats start dropping after the age-${p.peak} season.`,
  button: 'Try to extend',
  confirm: (p) => `This costs ${p.cost} with a ${p.chance}% chance. Failed tries are not refunded.`,
  confirmBtn: 'Try',
  cancel: 'Cancel',
  adCost: 'Ad',
  adNote: (p) => `Short on money? Watch an ad to try (${p.left} left this career).`,
  adNoteFree: (p) => `With ad-free you can try without money (${p.left} left this career).`,
  adWatch: 'Watch the whole ad to try.',
  note: (p) =>
    `Starting the season before your peak age, try once per season, up to ${p.max} levels. Each failure adds ${p.pct}%p to the next try.`,
  noteGreat: (p) => `${p.pct}% of successes are great successes that add two years at once.`,
  historyOk: (p) => `${p.y} +${p.lv} success (${p.pct}% · ${p.cost})`,
  historyGreat: (p) => `${p.y} +${p.lv} great success (${p.pct}% · ${p.cost})`,
  historyFail: (p) => `${p.y} +${p.lv} failed (${p.pct}% · ${p.cost})`,
  resultOkTitle: 'Prime extended',
  resultGreatTitle: 'Great success! Two years added',
  resultFailTitle: 'Extension failed',
  resultOk: (p) => `Stats now start dropping after the age-${p.peak} season.`,
  resultFail: (p) => `Your next try gets ${p.pct}%p more.`,
};
