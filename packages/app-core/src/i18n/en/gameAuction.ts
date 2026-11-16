import type { Translation } from '../core';
import type { GameAuctionMsgs } from '../ko/gameAuction';

export const gameAuction: Translation<GameAuctionMsgs> = {
  title: 'Luxury Auction',
  line: (p) =>
    `This season's lots are up. Each costs ${p.cost}, and you only see the grade when you open the box.`,
  lineDone: "You've bought every lot this season. New lots arrive next season.",
  buy: 'Bid',
  got: 'Won',
  short: 'Not enough',
  confirm: (p) => `Buy the ${p.item} box for ${p.cost}? You'll see the grade when you open it.`,
  confirmBtn: 'Confirm bid',
  cancel: 'Cancel',
  odds: (p) => `Grade odds: Common ${p.g1}% · Fine ${p.g2}% · Luxury ${p.g3}% · Legendary ${p.g4}%`,
  note: 'Each piece has a value that is added to your retirement legacy (higher fame makes it worth more). Collect all four grades of one kind for a set bonus that slightly lifts match performance. Duplicates are sold back for half the price. When you retire, your top 3 pieces stay in the Hall of Fame.',
  adButton: 'Get new lots',
  adBadge: 'Ad',
  adNote: "Watch an ad to get a new set of this season's lots (once per season).",
  adNoteFree: "With Remove Ads, you can get a new set of this season's lots (once per season).",
  adWatch: 'Watch the full ad to get new lots.',
  refreshed: 'New lots are up.',
  shelfWorth: (p) => (p.sets ? `Value ${p.value} · Sets ${p.sets}` : `Value ${p.value}`),
  shelfTitle: 'Showcase',
  shelfCount: (p) => `Collection ${p.n}/${p.total}`,
  shelfLabel: (p) => `${p.item} ${p.grade} ${p.on ? 'owned' : 'missing'}`,
  rolling: 'Opening the box…',
  resultTitle: (p) => `${p.grade} ${p.item}`,
  resultNew: (p) => `A new piece joins your showcase. Value ${p.value}.`,
  resultDupe: (p) => `You already had this piece, so it sold for ${p.refund}.`,
  resultComplete: (p) =>
    `You've collected all four grades of ${p.item}. The set bonus slightly lifts your match performance.`,
  close: 'OK',
  creditTitle: 'Signature Pieces',
};
