import { loadKey, saveKey } from '@offside/game/storage';

export type GameCenterOfferPlace = 'home' | 'retire';
const KEY = 'ft_game_services_offer_v1';
export const GAME_CENTER_OFFER_GAP_MS = 7 * 24 * 60 * 60 * 1000;
type History = { home: boolean; retire: boolean; handled: boolean; lastShownAt: number | null };
const saved = loadKey<Partial<History>>(KEY);
const history: History = {
  home: saved?.home === true,
  retire: saved?.retire === true,
  handled: saved?.handled === true,
  lastShownAt:
    typeof saved?.lastShownAt === 'number' && Number.isFinite(saved.lastShownAt)
      ? saved.lastShownAt
      : null,
};

/** Once per place and device, with a shared gap so returning home never immediately asks again. */
export function takeGameCenterOffer(place: GameCenterOfferPlace, eligible: boolean): boolean {
  if (!eligible || history.handled || history[place]) return false;
  const now = Date.now();
  if (history.lastShownAt !== null && now - history.lastShownAt < GAME_CENTER_OFFER_GAP_MS)
    return false;
  history[place] = true;
  history.lastShownAt = now;
  saveKey(KEY, history);
  return true;
}

/** Closing an offer or accepting connection ends this campaign; manual entry remains available. */
export function finishGameCenterOffers() {
  history.handled = true;
  saveKey(KEY, history);
}
