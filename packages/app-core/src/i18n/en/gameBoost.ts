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
  lineExtra: (p) =>
    `You've used this season's try. You can try again with an ad or club funds, ${p.left} extra ${p.left === 1 ? 'try' : 'tries'} left for this player.`,
  lineExtraClub: (p) =>
    `You've used this season's try. You can try again with club funds, ${p.left} extra ${p.left === 1 ? 'try' : 'tries'} left for this player.`,
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
  adButton: (p) => `Watch an ad to boost (${p.chance}%)`,
  adButtonFree: (p) => `Boost without funds (${p.chance}%)`,
  adNote:
    'Watch an ad to the end to try once without funds. The success chance is the same as paying with funds.',
  adNoteFree: 'You bought ad removal, so you can try once without funds.',
  adNoteExtra: (p) =>
    `Watch the whole ad to try once more without funds. ${p.left} extra ${p.left === 1 ? 'try' : 'tries'} left for this player.`,
  adNoteExtraFree: (p) =>
    `You bought ad removal, so you can try once more without funds. ${p.left} extra ${p.left === 1 ? 'try' : 'tries'} left for this player.`,
  adWatch: 'Watch the ad to the end to try the boost.',
  adCost: 'ad',
  extraCost: (p) => `${p.cost} (extra)`,
  clubCost: 'club funds',
  resultFailFree: (p) =>
    `The chance was ${p.chance}%. The next attempt's chance goes up by ${p.pct} percentage points.`,
  clubCandidates: (p) => `See candidate potential with club funds (${p.price})`,
  clubPeek: (p) => `See the rating with club funds (${p.price})`,
  clubBoost: (p) => `Boost with club funds (${p.price} · ${p.chance}%)`,
  clubConfirm: (p) =>
    `This uses ${p.price} of club funds. You'll have ${p.balance} left, and this can't be undone.`,
  clubAskTitle: 'Use club funds',
  clubAction: 'Use',
  clubBusy: 'Using club funds…',
  clubNote:
    'Watch an ad or use club funds to get this. Club funds cost more each time you use them on the same day.',
  clubFail: "Couldn't use club funds.",
};
