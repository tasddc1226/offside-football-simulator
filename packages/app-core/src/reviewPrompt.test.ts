import { describe, expect, it, vi } from 'vitest';
import {
  canRequestReview,
  createReviewPrompt,
  reviewHistory,
  reviewWorthyCareer,
  REVIEW_GAP_MS,
} from './reviewPrompt';

function fixture() {
  let history: unknown;
  let now = Date.UTC(2026, 9, 4);
  let version = '1.0.2';
  const io = {
    load: () => history,
    save: vi.fn((h) => {
      history = h;
    }),
    now: () => now,
    version: () => version,
    available: vi.fn(async () => true),
    request: vi.fn(async () => {}),
  };
  return {
    io,
    prompt: createReviewPrompt(io),
    advance: (ms: number) => {
      now += ms;
    },
    version: (v: string) => {
      version = v;
    },
  };
}

describe('app store review request policy', () => {
  it('requests immediately after the first finished career without age, score or play-count gates', async () => {
    const f = fixture();
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(true);
    expect(f.io.request).toHaveBeenCalledOnce();
    expect(reviewHistory(f.io.load())).toMatchObject({
      lastVersion: '1.0.2',
      lastCareerId: 'career-1',
    });
  });
  it('T-11-586 asks again on the same app version after 45 days at a new moment, even after reopening', async () => {
    const f = fixture();
    await f.prompt.afterHighlight('career-1', () => true);
    f.advance(REVIEW_GAP_MS);
    const reopened = createReviewPrompt(f.io);
    expect(await reopened.afterHighlight('gift:season-1', () => true)).toBe(true);
    expect(f.io.request).toHaveBeenCalledTimes(2);
  });
  it('requires a new moment and at least 45 days', async () => {
    const f = fixture();
    expect(REVIEW_GAP_MS).toBe(45 * 86_400_000);
    await f.prompt.afterHighlight('career-1', () => true);
    f.advance(REVIEW_GAP_MS - 1);
    expect(await f.prompt.afterHighlight('career-2', () => true)).toBe(false);
    f.advance(1);
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
    expect(await f.prompt.afterHighlight('career-2', () => true)).toBe(true);
  });
  it('limits requests to three in a rolling 365 days despite new versions', async () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) {
      f.version(`1.0.${i}`);
      expect(await f.prompt.afterHighlight(`career-${i}`, () => true)).toBe(true);
      f.advance(REVIEW_GAP_MS);
    }
    f.version('1.0.4');
    expect(await f.prompt.afterHighlight('career-4', () => true)).toBe(false);
    // 첫 요청(0일)이 365일을 넘어야 네 번째를 묻는다. 지금은 135일째다.
    f.advance(229 * 86_400_000);
    expect(await f.prompt.afterHighlight('career-4', () => true)).toBe(false);
    f.advance(86_400_000);
    expect(await f.prompt.afterHighlight('career-4', () => true)).toBe(true);
  });
  it('does not interrupt an unsafe screen or request on an unsupported device', async () => {
    const f = fixture();
    expect(await f.prompt.afterHighlight('career-1', () => false)).toBe(false);
    expect(f.io.available).not.toHaveBeenCalled();
    f.io.available.mockResolvedValue(false);
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
    expect(f.io.save).not.toHaveBeenCalled();
    expect(f.io.request).not.toHaveBeenCalled();
  });
  it('rechecks the screen and deduplicates requests while native availability is pending', async () => {
    const f = fixture();
    let resolve!: (available: boolean) => void;
    f.io.available.mockImplementation(
      () =>
        new Promise<boolean>((r) => {
          resolve = r;
        }),
    );
    let safe = true;
    const first = f.prompt.afterHighlight('career-1', () => safe);
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
    safe = false;
    resolve(true);
    expect(await first).toBe(false);
    expect(f.io.request).not.toHaveBeenCalled();
  });
  it('persists before the OS call and does not retry suppressed or failed OS dialogs', async () => {
    const f = fixture();
    f.io.request.mockImplementation(async () => {
      expect(reviewHistory(f.io.load()).lastVersion).toBe('1.0.2');
      throw new Error('OS error');
    });
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
    expect(f.io.request).toHaveBeenCalledOnce();
  });
  it('does not request if the cooldown cannot be saved', async () => {
    const f = fixture();
    f.io.save.mockImplementation(() => {
      throw new Error('Storage full');
    });
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
    expect(f.io.request).not.toHaveBeenCalled();
  });
  it('pauses automatic requests after a manually opened store page', async () => {
    const f = fixture();
    f.prompt.manualOpened();
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
    f.version('1.1.0');
    expect(await f.prompt.afterHighlight('career-1', () => true)).toBe(false);
  });
  it('handles corrupt history and rejects missing versions, careers and backwards time', () => {
    expect(reviewHistory({ attempts: [NaN, -1, 'date', 15], lastVersion: 1 })).toEqual({
      lastVersion: '',
      lastCareerId: '',
      attempts: [15],
    });
    const empty = reviewHistory(null);
    expect(canRequestReview(empty, '', '1.0.2', 0)).toBe(false);
    expect(canRequestReview(empty, 'career', '', 0)).toBe(false);
    expect(canRequestReview({ ...empty, attempts: [100] }, 'career', '1.0.2', 99)).toBe(false);
  });
});

describe('T-11-586 review only after a good career', () => {
  it("asks after club legend or better, or any Ballon d'Or, and skips plain careers", () => {
    expect(reviewWorthyCareer(600, 'ST', 0)).toBe(true);
    expect(reviewWorthyCareer(599, 'ST', 0)).toBe(false);
    expect(reviewWorthyCareer(304, 'ST', 0)).toBe(false);
    expect(reviewWorthyCareer(100, 'ST', 1)).toBe(true);
    // 프리시즌 선수(세부 포지션 없음)는 낮은 기준표로 가른다.
    expect(reviewWorthyCareer(425, null, 0)).toBe(true);
    expect(reviewWorthyCareer(424, null, 0)).toBe(false);
  });
});
