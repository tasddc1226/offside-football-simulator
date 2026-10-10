import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  predictionPercentages,
  createCupPredictionController,
  type CupPredictionState,
} from './cupPredictions.js';
import { fetchCupPredictions, fetchCupPredictionsMe, putCupPrediction } from './api/cup.js';
vi.mock('./api/cup.js', () => ({
  fetchCupPredictions: vi.fn(),
  fetchCupPredictionsMe: vi.fn(),
  putCupPrediction: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
describe('cup prediction controller', () => {
  it('keeps zero votes at zero and non-empty proportions at 100 including two remainder points', () => {
    expect(predictionPercentages(undefined)).toEqual({ home: 0, draw: 0, away: 0 });
    expect(predictionPercentages({ matchId: 'm', home: 2, draw: 2, away: 3 })).toEqual({
      home: 29,
      draw: 28,
      away: 43,
    });
    expect(
      Object.values(predictionPercentages({ matchId: 'm', home: 1, draw: 1, away: 1 })).reduce(
        (a, b) => a + b,
      ),
    ).toBe(100);
  });
  it('loads per cup, replaces the changed match directly, and prevents duplicate in-flight writes', async () => {
    vi.mocked(fetchCupPredictions).mockResolvedValue({ ok: true, data: { items: [] } });
    vi.mocked(fetchCupPredictionsMe).mockResolvedValue({ ok: true, data: { items: [] } });
    let finish!: (r: Awaited<ReturnType<typeof putCupPrediction>>) => void;
    vi.mocked(putCupPrediction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let s!: CupPredictionState;
    const ctl = createCupPredictionController((x) => (s = x));
    await ctl.load('s1-1', true);
    const save = ctl.pick('m', 'home');
    await ctl.pick('m', 'away');
    expect(putCupPrediction).toHaveBeenCalledTimes(1);
    finish({ ok: true, data: { matchId: 'm', home: 1, draw: 0, away: 0 } });
    await save;
    expect(s.mine.m?.pick).toBe('home');
    expect(s.counts.m?.home).toBe(1);
    expect(fetchCupPredictions).toHaveBeenCalledTimes(1);
  });
  it('ignores an account change during a write and blocks editing when own picks failed to load', async () => {
    vi.mocked(fetchCupPredictions).mockResolvedValue({ ok: true, data: { items: [] } });
    vi.mocked(fetchCupPredictionsMe).mockResolvedValue({ ok: true, data: { items: [] } });
    let finish!: (r: Awaited<ReturnType<typeof putCupPrediction>>) => void;
    vi.mocked(putCupPrediction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let s!: CupPredictionState;
    const ctl = createCupPredictionController((x) => (s = x));
    await ctl.load('s1-1', true);
    const save = ctl.pick('m', 'home');
    await ctl.load('s1-1', false);
    finish({ ok: true, data: { matchId: 'm', home: 1, draw: 0, away: 0 } });
    await save;
    expect(s.mine).toEqual({});
    vi.mocked(fetchCupPredictionsMe).mockResolvedValue({
      ok: false,
      error: { code: 'FAIL', message: 'fail', retryable: true },
    });
    await ctl.load('s1-1', true);
    await ctl.pick('m', 'away');
    expect(putCupPrediction).toHaveBeenCalledTimes(1);
  });
});
