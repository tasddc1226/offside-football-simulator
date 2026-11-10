/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({
  values: new Map(),
  events: [],
  offer: { handled: false, snoozedUntil: 0, eligible: true },
  state: { enabled: false, busy: false, failed: false, blocked: false, message: '' },
  outcome: 'granted',
  toast: vi.fn(),
  save: vi.fn(),
  check: vi.fn(),
  dismiss: vi.fn(),
  snooze: vi.fn(),
}));
vi.mock('../game/host', () => ({ toast: f.toast }));
vi.mock('./pushPreferences', () => ({ savePushTopics: f.save }));
vi.mock('@offside/app-core/i18n/ko/push', () => ({
  pushText: new Proxy({}, { get: (_t, key) => String(key) }),
}));
vi.mock('../analytics', () => ({
  nativeAnalytics: { pushAsk: (...args) => f.events.push(args) },
}));
vi.mock('./push', () => ({
  pushState: f.state,
  pushRegistration: {
    setEnabled: async () => {
      f.state.enabled = f.outcome === 'granted';
      f.state.failed = f.outcome === 'failed';
      f.state.blocked = f.outcome === 'blocked';
    },
  },
}));
vi.mock('./pushOffer', () => ({
  pushOffer: f.offer,
  checkPushOffer: f.check,
  dismissPushOffer: () => {
    f.offer.handled = true;
    f.dismiss();
  },
  snoozePushOffer: f.snooze,
}));
vi.mock('./setup', () => ({
  kv: {
    getBoolean: (key) => f.values.get(key),
    getNumber: (key) => f.values.get(key),
    getString: (key) => f.values.get(key),
    set: (key, value) => f.values.set(key, value),
    remove: (key) => f.values.delete(key),
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useRealTimers();
  f.values.clear();
  f.events.length = 0;
  Object.assign(f.offer, { handled: false, snoozedUntil: 0, eligible: true });
  Object.assign(f.state, { enabled: false, busy: false, failed: false, blocked: false });
  f.outcome = 'granted';
  f.check.mockResolvedValue(undefined);
  f.save.mockResolvedValue(true);
});

describe('moment push asks', () => {
  it('asks each moment once and keeps three days between asks', async () => {
    const p = await import('./pushAsk.ts');
    expect(await p.pushAskOpen('sell')).toBe(true);
    p.laterPushAsk('sell');
    expect(await p.pushAskOpen('sell')).toBe(false);
    expect(await p.pushAskOpen('club')).toBe(false);
    f.values.set('offside_push_ask_last', Date.now() - p.PUSH_ASK_GAP_MS - 1);
    expect(await p.pushAskOpen('club')).toBe(true);
    expect(f.events).toEqual([['later', 'sell']]);
    expect(f.snooze).not.toHaveBeenCalled();
  });

  it('home later keeps the 7-day home snooze and also delays moment asks', async () => {
    const p = await import('./pushAsk.ts');
    p.laterPushAsk('home');
    expect(f.snooze).toHaveBeenCalledOnce();
    expect(await p.pushAskOpen('retire')).toBe(false);
  });

  it('never asks when already on, handled or not eligible', async () => {
    const p = await import('./pushAsk.ts');
    f.state.enabled = true;
    expect(await p.pushAskOpen('sell')).toBe(false);
    f.state.enabled = false;
    f.offer.handled = true;
    expect(await p.pushAskOpen('sell')).toBe(false);
    f.offer.handled = false;
    f.offer.eligible = false;
    expect(await p.pushAskOpen('sell')).toBe(false);
  });

  const PICKS = { game: true, market: true, social: false, news: true, nudge: false };

  it('asks what to receive before the OS prompt, then records the choice and the OS result', async () => {
    let p = await import('./pushAsk.ts');
    f.outcome = 'denied';
    let done = p.acceptPushAsk('retire');
    expect(p.pushPicker).toMatchObject({ open: true, place: 'retire', title: 'pickTitle' });
    expect(f.events).toEqual([['accept', 'retire']]);
    p.closePushPicker(PICKS);
    expect(await done).toBe(true);
    expect(p.pushPicker.open).toBe(false);
    expect(f.events).toEqual([
      ['accept', 'retire'],
      ['pick', 'retire', undefined, 'game,market,news'],
      ['result', 'retire', 'denied'],
    ]);
    expect(f.offer.handled).toBe(true);
    // OS에서 거절하면 고른 값은 기기에만 둔다. 나중에 알림이 켜지면 그때 계정에 저장한다.
    expect(f.save).not.toHaveBeenCalled();
    f.state.enabled = true;
    await p.applyPushPicks();
    expect(f.save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ match: true, friend: false, reward: false, attendance: false }),
    );
    await p.applyPushPicks();
    expect(f.save).toHaveBeenCalledOnce();

    vi.resetModules();
    f.events.length = 0;
    f.offer.handled = false;
    f.state.enabled = false;
    f.outcome = 'failed';
    p = await import('./pushAsk.ts');
    done = p.acceptPushAsk('home');
    p.closePushPicker(PICKS);
    await done;
    expect(f.events.at(-1)).toEqual(['result', 'home', 'failed']);
    expect(f.offer.handled).toBe(false);
  });

  it('saves the chosen topics in one request once notifications are on', async () => {
    const p = await import('./pushAsk.ts');
    const done = p.acceptPushAsk('home');
    p.closePushPicker(PICKS);
    await done;
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.values.has('offside_push_picks')).toBe(false);
  });

  it('closing the picker from a card asks nothing and keeps the card', async () => {
    const p = await import('./pushAsk.ts');
    const done = p.acceptPushAsk('home');
    p.closePushPicker(null);
    expect(await done).toBe(false);
    expect(f.events).toEqual([['accept', 'home']]);
    expect(f.offer.handled).toBe(false);
    expect(f.snooze).not.toHaveBeenCalled();
  });

  it('opens the picker after a moment, tracks the view, and treats closing as later', async () => {
    vi.useFakeTimers();
    const p = await import('./pushAsk.ts');
    await p.askPushAfter('club');
    expect(p.pushPicker.open).toBe(false);
    vi.advanceTimersByTime(800);
    expect(p.pushPicker).toMatchObject({ open: true, place: 'club', title: 'askClubTitle' });
    expect(f.events).toEqual([['view', 'club']]);
    p.closePushPicker(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.values.get('offside_push_ask_club')).toBe(true);
    expect(f.events.at(-1)).toEqual(['later', 'club']);
  });

  it('T-11-586 asks after league entry with the club copy and after cup entry with the cup copy', async () => {
    vi.useFakeTimers();
    const p = await import('./pushAsk.ts');
    await p.askPushAfter('league');
    vi.advanceTimersByTime(800);
    expect(p.pushPicker.title).toBe('askClubTitle');
    p.closePushPicker(null);
    await vi.advanceTimersByTimeAsync(0);
    f.values.set('offside_push_ask_last', Date.now() - p.PUSH_ASK_GAP_MS - 1);
    await p.askPushAfter('cup');
    vi.advanceTimersByTime(800);
    expect(p.pushPicker.title).toBe('askCupTitle');
    p.closePushPicker(PICKS);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.events).toEqual([
      ['view', 'league'],
      ['later', 'league'],
      ['view', 'cup'],
      ['accept', 'cup'],
      ['pick', 'cup', undefined, 'game,market,news'],
      ['result', 'cup', 'granted'],
    ]);
  });
});
