import { describe, expect, it, vi } from 'vitest';
import { appStatusTools, daysBefore } from './appStatus.ts';
import type { Env } from './env.ts';

vi.mock('./reviews.ts', () => ({
  ascReady: (env: Env) => Boolean(env.ASC_APP_ID),
  ascToken: async () => 'asc',
  playAccount: (env: Env) => (env.PLAY_SA_KEY ? { email: 'x', key: 'k' } : undefined),
}));
vi.mock('./google.ts', () => ({ serviceAccountToken: async () => 'g' }));

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('app_status (T-11-332)', () => {
  it('n일 전 날짜는 달 · 해를 넘기고 시간대를 그대로 둔다', () => {
    expect(
      daysBefore({ year: 2026, month: 1, day: 3, timeZone: { id: 'America/Los_Angeles' } }, 7),
    ).toEqual({ year: 2025, month: 12, day: 27, timeZone: { id: 'America/Los_Angeles' } });
  });

  it('App Store 상태 · Play 안정성 · EAS를 모으고, 연결 안 된 곳은 그렇게 말한다', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('appStoreVersions'))
        return ok({
          data: [
            {
              attributes: {
                versionString: '1.1.3',
                appStoreState: 'READY_FOR_SALE',
                createdDate: '2026-10-16T01:47:08Z',
              },
            },
          ],
        });
      if (url.endsWith('crashRateMetricSet') || url.endsWith('anrRateMetricSet'))
        return ok({
          freshnessInfo: {
            freshnesses: [
              { aggregationPeriod: 'DAILY', latestEndTime: { year: 2026, month: 10, day: 16 } },
            ],
          },
        });
      if (url.endsWith('crashRateMetricSet:query')) {
        const body = JSON.parse(init!.body as string);
        expect(body.timelineSpec.startTime).toEqual({ year: 2026, month: 10, day: 9 });
        return ok({
          rows: [
            {
              startTime: { year: 2026, month: 10, day: 15 },
              metrics: [
                { metric: 'crashRate', decimalValue: { value: '0.0123' } },
                { metric: 'distinctUsers', decimalValue: { value: '81' } },
              ],
            },
          ],
        });
      }
      if (url.endsWith('anrRateMetricSet:query')) return ok({});
      if (url.includes('errorIssues:search'))
        return ok({
          errorIssues: [
            {
              type: 'CRASH',
              cause: 'java.lang.IllegalStateException',
              location: 'com.x.Y',
              errorReportCount: '5',
              distinctUsers: '3',
              lastAppVersion: { versionCode: '20' },
            },
          ],
        });
      throw new Error(`unexpected ${url}`);
    });
    const env = {
      ASC_APP_ID: '1',
      PLAY_PACKAGE: 'com.offsidelab.app',
      PLAY_SA_KEY: 'k',
    } as unknown as Env;
    const out = await appStatusTools(env, fetcher as unknown as typeof fetch)[0]!.run({});
    expect(out).toContain('- 1.1.3: READY_FOR_SALE (만듦 10-16 10:47 KST)');
    expect(out).toContain('비정상 종료율(일별, 사용자 수): 10-15 1.23% (81명)');
    expect(out).toContain('- ANR율: 2026-10-16까지 기록 없음');
    expect(out).toContain('CRASH java.lang.IllegalStateException @ com.x.Y: 5건 · 3명');
    expect(out).toContain('**EAS 빌드 · OTA**\n- 연결 안 됨(비밀값 없음)');
  });

  it('읽기가 실패하면 그 부분만 실패로 적는다', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ errors: [{ detail: 'forbidden' }] }), { status: 403 }),
    );
    const env = { ASC_APP_ID: '1', EXPO_TOKEN: 't' } as unknown as Env;
    const out = await appStatusTools(env, fetcher as unknown as typeof fetch)[0]!.run({
      part: 'ios',
    });
    expect(out).toBe('**App Store**\n- 읽지 못함: App Store Connect 403 forbidden');
  });
});
