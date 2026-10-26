/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({
  values: new Map(),
  events: [],
  offer: { handled: false, snoozedUntil: 0, eligible: true },
  state: { enabled: false, busy: false, failed: false, blocked: false, message: '' },
  outcome: 'granted',
  alert: vi.fn(),
  check: vi.fn(),
  dismiss: vi.fn(),
  snooze: vi.fn(),
}));
vi.mock('react-native', () => ({ Alert: { alert: f.alert } }));
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
    set: (key, value) => f.values.set(key, value),
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

  it('records the OS result and stops asking unless registration failed', async () => {
    let p = await import('./pushAsk.ts');
    f.outcome = 'denied';
    await p.acceptPushAsk('retire');
    expect(f.events).toEqual([
      ['accept', 'retire'],
      ['result', 'retire', 'denied'],
    ]);
    expect(f.offer.handled).toBe(true);

    vi.resetModules();
    f.events.length = 0;
    f.offer.handled = false;
    f.outcome = 'failed';
    p = await import('./pushAsk.ts');
    await p.acceptPushAsk('home');
    expect(f.events.at(-1)).toEqual(['result', 'home', 'failed']);
    expect(f.offer.handled).toBe(false);
  });

  it('shows a confirm after a moment and tracks the view', async () => {
    vi.useFakeTimers();
    const p = await import('./pushAsk.ts');
    await p.askPushAfter('club');
    expect(f.alert).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    expect(f.alert).toHaveBeenCalledOnce();
    expect(f.alert.mock.calls[0][0]).toBe('askClubTitle');
    expect(f.events).toEqual([['view', 'club']]);
    const later = f.alert.mock.calls[0][2].find((b) => b.style === 'cancel');
    later.onPress();
    expect(f.values.get('offside_push_ask_club')).toBe(true);
  });
});
