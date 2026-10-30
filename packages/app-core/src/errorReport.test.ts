import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { configureApi } from './api/client';
import {
  MAX_PER_SESSION,
  configureErrorReport,
  flushErrors,
  reportError,
  resetErrorReportForTest,
} from './errorReport';

const mem = new Map<string, string>();
const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
const bodies = () =>
  fetchMock.mock.calls.map((c) =>
    JSON.parse((c as unknown as [string, RequestInit])[1].body as string),
  );

describe('앱·웹 오류 보내기 (T-11-331)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mem.clear();
    setStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    configureApi({
      baseUrl: 'https://api.test',
      auth: () => ({ headers: { Authorization: 'Bearer t' } }),
    });
    resetErrorReportForTest();
    configureErrorReport({ platform: 'ios', version: '1.1.3 (18)' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('몇 초 모았다가 한 번에 보내고, 같은 오류는 한 번만 보낸다', async () => {
    reportError('error', new TypeError('x is undefined'), 'play');
    reportError('error', new TypeError('x is undefined'), 'play');
    reportError('rejection', 'network down');
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/client-errors');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t' });
    expect(bodies()[0]).toMatchObject({
      platform: 'ios',
      version: '1.1.3 (18)',
      items: [
        { kind: 'error', message: 'TypeError: x is undefined', where: 'play' },
        { kind: 'rejection', message: 'network down' },
      ],
    });
  });

  it('다른 출처 · 확장 프로그램 오류는 보내지 않는다', () => {
    expect(reportError('error', 'Script error.')).toBe(false);
    expect(
      reportError('error', new ReferenceError("Can't find variable: _AutofillCallbackHandler")),
    ).toBe(false);
    const e = new Error('boom');
    e.stack = 'Error: boom\n at chrome-extension://abc/x.js:1:1';
    expect(reportError('error', e)).toBe(false);
  });

  it(`한 번 켜진 동안 ${MAX_PER_SESSION}건까지만 보낸다`, async () => {
    for (let i = 0; i < MAX_PER_SESSION + 5; i++) reportError('error', `e${i}`);
    flushErrors();
    flushErrors();
    await vi.advanceTimersByTimeAsync(3000);
    expect(bodies().reduce((n, b) => n + b.items.length, 0)).toBe(MAX_PER_SESSION);
  });

  it('fatal은 저장해 두었다가 보내기에 실패하면 다음 실행에 보낸다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    reportError('fatal', new Error('crash'), 'root');
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(mem.get('offside.errors.pending')!)).toHaveLength(1);
    resetErrorReportForTest();
    configureErrorReport({ platform: 'ios', version: '1.1.3 (18)' });
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies().at(-1)).toMatchObject({ items: [{ kind: 'fatal', message: 'Error: crash' }] });
    expect(JSON.parse(mem.get('offside.errors.pending')!)).toEqual([]);
  });
});
