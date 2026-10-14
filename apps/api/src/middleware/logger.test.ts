import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../env.js';
import { INFO_LOG_SAMPLE_RATE, logger } from './logger.js';

/** T-11-252 요청 로그 샘플링. 운영에서만 정상 응답 줄을 줄이고, 경고·오류와 다른 환경은 그대로 남긴다. */
function build(environment: string) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('startedAt', Date.now());
    c.set('requestId', 'req_test');
    await next();
  });
  app.use('*', logger);
  app.get('/ok', (c) => c.text('ok'));
  app.get('/missing', (c) => c.text('missing', 404));
  return (path: string) =>
    app.request(`https://api.example${path}`, {}, {
      ENVIRONMENT: environment,
    } as AppEnv['Bindings']);
}

describe('요청 로그 샘플링', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  afterEach(() => {
    logSpy?.mockRestore();
    vi.restoreAllMocks();
  });

  it('운영의 정상 응답은 INFO_LOG_SAMPLE_RATE 비율로만 남기고 sampleRate를 적는다', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetch = build('production');
    vi.spyOn(Math, 'random').mockReturnValue(INFO_LOG_SAMPLE_RATE); // 비율 바깥 → 버린다
    await fetch('/ok');
    expect(logSpy).not.toHaveBeenCalled();

    vi.spyOn(Math, 'random').mockReturnValue(0); // 비율 안 → 남긴다
    await fetch('/ok');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({ level: 'info', status: 200, sampleRate: INFO_LOG_SAMPLE_RATE });
  });

  it('운영의 경고·오류 응답은 전부 남긴다', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetch = build('production');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await fetch('/missing');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({ level: 'warn', status: 404 });
    expect(entry.sampleRate).toBeUndefined();
  });

  it('운영이 아닌 환경은 정상 응답도 전부 남긴다', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetch = build('local');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await fetch('/ok');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toMatchObject({
      level: 'info',
      status: 200,
    });
  });
});
