import type { Translation } from '../core';
import type { CardEnhanceMsgs } from '../ko/cardEnhance';

export const cardEnhance: Translation<CardEnhanceMsgs> = {
  title: 'Card enhance',
  open: 'Enhance',
  openAria: (p) => `Enhance ${p.name}'s card`,
  now: 'Now',
  next: 'On success',
  rate: 'Success rate',
  cost: 'Cost',
  balance: 'Club funds',
  tries: 'Tries',
  triesN: (p) => (p.n === 1 ? '1 try' : `${p.n} tries`),
  nextTry: (p) =>
    p.n === 1 ? 'One more start earns another try.' : `${p.n} more starts earn another try.`,
  triesHow: (p) => `Each ${p.n} ranked matches this card starts for your club earns it one try.`,
  ovr: (p) => `Enhance OVR +${p.now} → +${p.next}`,
  effectNote:
    "Enhance OVR adds to slot ratings, team OVR and wages for your club. The player's career peak OVR and records stay the same.",
  failStay: "A failed try doesn't lower the level.",
  ceiling: (p) =>
    p.n === 1
      ? 'One more failure at this level and the next try is guaranteed.'
      : `${p.n} more failures at this level and the next try is guaranteed.`,
  sure: 'This try is guaranteed to succeed.',
  go: 'Enhance',
  going: 'Enhancing…',
  close: 'Close',
  success: (p) => `Enhanced to +${p.lv}.`,
  failKeep: (p) => `The enhance failed. Still +${p.lv}.`,
  max: 'This card is at the highest level.',
  short: 'Not enough club funds.',
  noTry: 'No tries left.',
  closed: 'Card enhance is closed right now.',
  listed: "Players on the transfer list can't be enhanced.",
  stale: 'The enhance status changed. We loaded the latest one.',
  loadFail: "Couldn't load enhance info.",
  retry: 'Try again',
  tryFail: "Couldn't enhance. Please try again in a moment.",
  sellNote: (p) => `The +${p.lv} enhance value of ${p.value} is added to the price range.`,
};
