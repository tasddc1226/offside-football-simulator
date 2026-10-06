import type { Translation } from '../core';
import type { GameBoostMsgs } from '../ko/gameBoost';

export const gameBoost: Translation<GameBoostMsgs> = {
  title: 'Potential boost',
  stepsLabel: (p) => `Level ${p.lv} of ${p.max}`,
  rolling: 'Boosting…',
  chance: (p) => `${p.n}% chance`,
  confirmBtn: 'Boost',
  cancel: 'Cancel',
  close: 'OK',
  adLoading: 'Loading ad…',
  note: (p) =>
    `You can try once a season, up to age ${p.age}. If it fails, you only lose the money, and the next chance goes up by ${p.pct} percentage points.`,
  lineLocked: 'You can boost after your first season.',
  lineAged: (p) => `You're past ${p.age}, so you can't boost anymore.`,
  lineMax: (p) => `You've reached the top level (+${p.lv}).`,
  lineDone: "You've already tried this season. You can try again next season.",
  lineShort: (p) => `Not enough funds. The next level costs ${p.cost}.`,
  lineReady: (p) => `Next level +${p.next} · ${p.chance}% chance · ${p.cost}`,
  button: (p) => `Pay ${p.cost} to boost (${p.chance}%)`,
  confirm: (p) =>
    `You'll spend ${p.cost} for a ${p.chance}% chance. If it fails, you won't get it back.`,
  historyOk: (p) => `${p.y} · level +${p.lv} ${p.pct}% · ${p.cost} · success`,
  historyFail: (p) => `${p.y} · level +${p.lv} ${p.pct}% · ${p.cost} · failed`,
  resultOkTitle: (p) => `Level +${p.lv} reached`,
  resultFailTitle: 'Boost failed',
  resultOkMax: "You've reached the top level. Your growth ceiling rose a little more.",
  resultOk: 'Your growth ceiling rose a little.',
  resultFail: (p) =>
    `The chance was ${p.chance}%. The money is gone, and the next attempt's chance goes up by ${p.pct} percentage points.`,
};
