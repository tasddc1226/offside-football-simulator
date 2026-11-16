/* global vi, beforeEach, afterEach, describe, it, expect */
const f = vi.hoisted(() => ({ values: new Map(), save: vi.fn() }));
vi.mock('@offside/game/storage', () => ({
  loadKey: (key) => f.values.get(key) ?? null,
  saveKey: (key, value) => {
    f.values.set(key, structuredClone(value));
    f.save(key, value);
    return true;
  },
}));
const KEY = 'ft_game_services_offer_v1';
const now = Date.parse('2026-11-16T00:00:00Z');
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.values.clear();
  vi.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => vi.restoreAllMocks());

describe('game services connection offers', () => {
  it('does not consume an offer for unsupported, connected or ineligible users', async () => {
    const m = await import('./gameCenterOffer.ts');
    expect(m.takeGameCenterOffer('home', false)).toBe(false);
    expect(f.save).not.toHaveBeenCalled();
    expect(m.takeGameCenterOffer('home', true)).toBe(true);
    expect(f.save).toHaveBeenCalledWith(KEY, expect.objectContaining({ home: true }));
  });

  it('remembers each offer across app restarts', async () => {
    let m = await import('./gameCenterOffer.ts');
    expect(m.takeGameCenterOffer('home', true)).toBe(true);
    vi.resetModules();
    m = await import('./gameCenterOffer.ts');
    expect(m.takeGameCenterOffer('home', true)).toBe(false);
  });

  it('does not ask again when going home from the first retirement', async () => {
    const m = await import('./gameCenterOffer.ts');
    expect(m.takeGameCenterOffer('retire', true)).toBe(true);
    expect(m.takeGameCenterOffer('home', true)).toBe(false);
    Date.now.mockReturnValue(now + m.GAME_CENTER_OFFER_GAP_MS);
    expect(m.takeGameCenterOffer('home', true)).toBe(true);
    expect(m.takeGameCenterOffer('retire', true)).toBe(false);
  });

  it('closing either offer ends both offers after restart and after the shared gap', async () => {
    let m = await import('./gameCenterOffer.ts');
    m.takeGameCenterOffer('home', true);
    m.finishGameCenterOffers();
    vi.resetModules();
    m = await import('./gameCenterOffer.ts');
    Date.now.mockReturnValue(now + 2 * m.GAME_CENTER_OFFER_GAP_MS);
    expect(m.takeGameCenterOffer('home', true)).toBe(false);
    expect(m.takeGameCenterOffer('retire', true)).toBe(false);
  });

  it('connection from settings also prevents later offers', async () => {
    const m = await import('./gameCenterOffer.ts');
    m.finishGameCenterOffers();
    expect(m.takeGameCenterOffer('home', true)).toBe(false);
    expect(m.takeGameCenterOffer('retire', true)).toBe(false);
    expect([...f.values.keys()]).toEqual([KEY]);
  });

  it('ignores malformed stored history without touching career saves', async () => {
    f.values.set(KEY, { home: 'true', retire: 1, handled: 'true', lastShownAt: 'bad' });
    f.values.set('ft_save', { legacy: 'unchanged' });
    const m = await import('./gameCenterOffer.ts');
    expect(m.takeGameCenterOffer('home', true)).toBe(true);
    expect(f.values.get('ft_save')).toEqual({ legacy: 'unchanged' });
  });
});
