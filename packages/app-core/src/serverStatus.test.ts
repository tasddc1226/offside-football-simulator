import { describe, expect, it } from 'vitest';
import type { ServerStatus } from '@offside/contracts';
import { serverStatusView } from './serverStatus';

const NOW = Date.parse('2026-10-16T03:07:00.000Z'); // KST 12:07
const b = (at: string, requests: number, avgMs: number, slow = 0, errors = 0) => ({
  at,
  requests,
  avgMs,
  slow,
  errors,
});
const data = (buckets: ServerStatus['buckets'], days: ServerStatus['days'] = []): ServerStatus => ({
  generatedAt: new Date(NOW).toISOString(),
  buckets,
  days,
});

describe('서버 상태 화면 (T-11-321)', () => {
  it('끝난 칸 셋(최근 15분)으로 판정하고, 지금 차는 칸은 뺀다', () => {
    const v = serverStatusView(
      data([
        b('2026-10-16T02:50:00.000Z', 150, 200),
        b('2026-10-16T02:55:00.000Z', 150, 300),
        b('2026-10-16T03:00:00.000Z', 300, 250),
        b('2026-10-16T03:05:00.000Z', 10, 9000, 10, 10), // 차는 중
      ]),
      NOW,
    );
    expect(v.level).toBe('ok');
    expect(v.recent).toEqual([
      ['분당 요청', '40'],
      ['평균 응답', '250ms'],
      ['1초 넘게 걸린 요청', '0%'],
      ['서버 오류', '0%'],
    ]);
    expect(v.hours).toHaveLength(24);
    expect(v.hours.at(-1)).toMatchObject({ label: '12', requests: 310 });
    expect(v.hours.at(-2)).toMatchObject({
      label: '11',
      requests: 300,
      reqBar: expect.any(Number),
    });
  });

  it('느림·오류·기록 없음', () => {
    const at = '2026-10-16T03:00:00.000Z';
    expect(serverStatusView(data([b(at, 100, 900)]), NOW).level).toBe('slow');
    expect(serverStatusView(data([b(at, 100, 200, 20)]), NOW).level).toBe('slow');
    expect(serverStatusView(data([b(at, 100, 200, 0, 3)]), NOW).level).toBe('down');
    const empty = serverStatusView(data([]), NOW);
    expect(empty).toMatchObject({ level: 'unknown', recent: [], days: [], trend: null });
  });

  it('어제를 일주일 전과 비교한다', () => {
    const day = (d: string, requests: number) => ({
      day: d,
      requests,
      avgMs: 300,
      slow: 0,
      errors: 0,
    });
    const up = serverStatusView(data([], [day('2026-10-08', 1000), day('2026-10-15', 1500)]), NOW);
    expect(up.trend).toBe('어제 요청은 1,500건이에요. 일주일 전보다 50% 늘었어요.');
    expect(up.days[0]).toEqual({ day: '10.15', requests: '1,500', avg: '300ms', slow: '0%' });
    expect(serverStatusView(data([], [day('2026-10-15', 7)]), NOW).trend).toBe(
      '어제 요청은 7건이에요.',
    );
    expect(
      serverStatusView(data([], [day('2026-10-08', 1000), day('2026-10-15', 1020)]), NOW).trend,
    ).toContain('비슷해요');
  });
});
