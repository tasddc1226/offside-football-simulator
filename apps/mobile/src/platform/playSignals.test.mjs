/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({ state: 'active', listeners: [], now: 0 }));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return f.state;
    },
    addEventListener: (_type, fn) => f.listeners.push(fn),
  },
}));

const tap = (pageX, pageY) => ({ nativeEvent: { pageX, pageY } });
const setState = (st) => {
  f.state = st;
  for (const fn of f.listeners) fn(st);
};

beforeEach(() => {
  vi.resetModules();
  f.state = 'active';
  f.listeners = [];
  f.now = 1_000;
  vi.stubGlobal('performance', { now: () => f.now });
});

describe('앱 자동 플레이 탐지 요약 (T-11-590)', () => {
  it('터치 수 · 시간 · 백그라운드 시간을 웹과 같은 모양으로 싣고 다시 센다', async () => {
    const m = await import('./playSignals.ts');
    m.countTouch(tap(10.5, 20.25));
    m.countTouch(tap(200.33, 400.67));
    f.now = 31_000;
    setState('background');
    f.now = 41_000;
    setState('active');
    f.now = 61_000;
    expect(m.takePlaySignals()).toEqual({
      ms: 60_000,
      clicks: 0,
      keys: 0,
      touches: 2,
      moves: 0,
      synthetic: 0,
      hiddenMs: 10_000,
      webdriver: false,
      app: true,
      same: 0,
    });
    f.now = 71_000;
    expect(m.takePlaySignals()).toMatchObject({ ms: 10_000, touches: 0, hiddenMs: 0 });
  });

  it('바로 앞 4번 안의 똑같은 좌표만 같은 자리로 센다', async () => {
    const m = await import('./playSignals.ts');
    // 두 점을 번갈아 누르는 오토 클리커: 처음 두 번 뒤로는 전부 같은 자리.
    for (let i = 0; i < 10; i++) m.countTouch(i % 2 ? tap(100, 300) : tap(180, 620));
    // 사람 손가락은 같은 버튼도 조금씩 다른 점을 누른다.
    m.countTouch(tap(180.4, 619.7));
    m.countTouch(tap(181, 620.3));
    expect(m.takePlaySignals()).toMatchObject({ touches: 12, same: 8 });
  });

  it('백그라운드에서 시작하면 그 시간도 가려진 시간으로 센다', async () => {
    f.state = 'background';
    const m = await import('./playSignals.ts');
    f.now = 6_000;
    setState('active');
    f.now = 11_000;
    expect(m.takePlaySignals()).toMatchObject({ ms: 10_000, hiddenMs: 5_000 });
  });
});
