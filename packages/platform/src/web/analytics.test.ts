import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from './analytics.js';

type Listener = () => void;

function stubBrowserGlobals(): { fire: (type: 'pagehide' | 'visibilitychange') => void; setHidden: (hidden: boolean) => void } {
  const listeners = new Map<string, Listener[]>();
  const documentStub = {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener(type: string, fn: Listener) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
  };
  const windowStub = {
    addEventListener(type: string, fn: Listener) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
  };
  vi.stubGlobal('window', windowStub);
  vi.stubGlobal('document', documentStub);
  return {
    fire(type) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    setHidden(hidden) {
      documentStub.visibilityState = hidden ? 'hidden' : 'visible';
    },
  };
}

describe('createAnalytics (web 분석 큐)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let browser: ReturnType<typeof stubBrowserGlobals>;

  beforeEach(() => {
    browser = stubBrowserGlobals();
    sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon });
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function makeAnalytics(clientId = 'clt_test') {
    return createAnalytics('https://example.com/v1/analytics/events', {
      getClientId: () => Promise.resolve(clientId),
    });
  }

  it('큐가 20건이 되면 즉시 sendBeacon으로 배치 전송한다', async () => {
    const analytics = makeAnalytics();
    for (let i = 0; i < 20; i++) {
      analytics.track('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' });
    }
    await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1));

    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('https://example.com/v1/analytics/events');
    const body = JSON.parse(await blob.text()) as { clientId: string; events: unknown[] };
    expect(body.clientId).toBe('clt_test');
    expect(body.events).toHaveLength(20);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('20건 미만이면 10초 뒤 타이머로 전송한다', async () => {
    const analytics = makeAnalytics();
    analytics.track('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' });
    expect(sendBeacon).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1));
    const body = JSON.parse(await (sendBeacon.mock.calls[0] as [string, Blob])[1].text()) as { events: unknown[] };
    expect(body.events).toHaveLength(1);
  });

  it('pagehide면 대기 중인 이벤트를 즉시 전송한다', async () => {
    const analytics = makeAnalytics();
    analytics.track('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' });
    browser.fire('pagehide');
    await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1));
  });

  it('visibilitychange가 hidden이면 전송하고, visible이면 전송하지 않는다', async () => {
    const analytics = makeAnalytics();
    analytics.track('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' });

    browser.setHidden(false);
    browser.fire('visibilitychange');
    expect(sendBeacon).not.toHaveBeenCalled();

    browser.setHidden(true);
    browser.fire('visibilitychange');
    await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1));
  });

  it('sendBeacon이 없으면 fetch(keepalive)로 대체한다', async () => {
    vi.stubGlobal('navigator', {});
    const analytics = makeAnalytics();
    analytics.track('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' });
    browser.fire('pagehide');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/v1/analytics/events');
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body as string) as { events: unknown[] };
    expect(body.events).toHaveLength(1);
  });

  it('화이트리스트 밖 이벤트 이름은 큐에 넣지 않고 전송도 하지 않는다', async () => {
    const analytics = makeAnalytics();
    analytics.track('not_a_real_event', { anything: 'x' });
    browser.fire('pagehide');

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('빈 큐로 flush가 트리거되면 아무 것도 보내지 않는다', () => {
    makeAnalytics();
    browser.fire('pagehide');
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
