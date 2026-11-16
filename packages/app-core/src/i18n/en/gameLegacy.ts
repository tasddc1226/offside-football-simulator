import type { Translation } from '../core';
import type { GameLegacyMsgs } from '../ko/gameLegacy';

export const gameLegacy: Translation<GameLegacyMsgs> = {
  title: 'Retirement Legacy',
  linePick:
    'Choose what to leave with your remaining funds when you retire. The more you have left, the higher the tier.',
  lineBelow: (p) => `You need ${p.need} more to reach Bronze.`,
  lineTierNext: (p) =>
    `Retire now and you leave ${p.kind} at ${p.tier} tier. ${p.need} more for ${p.next}.`,
  lineTierMax: (p) => `Retire now and you leave ${p.kind} at ${p.tier} tier, the highest tier.`,
  ladderLabel: 'Tiers (remaining funds)',
  itemsLine: (p: { value: string }) =>
    `Your auction collection adds ${p.value}. Higher fame makes it worth more.`,
  note: 'When you retire, all remaining funds are spent and the type and tier go into the Hall of Fame. The amount stays hidden. Gold and above earn a title.',
  retireLine: (p) => `Retirement legacy: ${p.kind} at ${p.tier} tier.`,
  retireLineBelow: (p) => `Your legacy (${p.kind}) is below Bronze, so nothing is left.`,
  creditTitle: 'Retirement Legacy',
  creditAcademy:
    'At the academy named after the player, the next generation started kicking a ball.',
  creditCharity: "Off the pitch, the foundation carries the player's name forward.",
  creditClub: 'The club that offered the first pro contract got something back.',
};
