import type { Translation } from '@offside/contracts/i18n';
import type { GAuctionMsgs } from '../ko/gAuction';

export const gAuction: Translation<GAuctionMsgs> = {
  watch: 'Luxury Watch',
  car: 'Classic Car',
  art: 'Artwork',
  trophy: 'Trophy Replica',
  wine: 'Vintage Wine',
  shirt: 'Commemorative Shirt',
  g1: 'Common',
  g2: 'Fine',
  g3: 'Luxury',
  g4: 'Legendary',
  bought: (p) => `Won a ${p.item} at auction for ${p.cost}. The box held a ${p.grade} piece.`,
  dupe: (p) =>
    `Won a ${p.item} at auction for ${p.cost}. It was a ${p.grade} piece you already had, so you sold it for ${p.refund}.`,
  complete: (p) => `Collected all four grades of ${p.item} and filled a row of the showcase.`,
};
