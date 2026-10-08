import type { Translation } from '@offside/contracts/i18n';
import type { GBoostMsgs } from '../ko/gBoost';

export const gBoost: Translation<GBoostMsgs> = {
  success: (p) => `Potential boost succeeded. You are now at level ${p.lv} (${p.cost}).`,
  fail: (p) => `Potential boost failed (${p.cost}). Your odds go up next time.`,
  successAd: (p) => `Potential boost succeeded. You are now at level ${p.lv} (ad).`,
  failAd: 'Potential boost failed (ad). Your odds go up next time.',
  successClub: (p) => `Potential boost succeeded. You are now at level ${p.lv} (club funds).`,
  failClub: 'Potential boost failed (club funds). Your odds go up next time.',
};
