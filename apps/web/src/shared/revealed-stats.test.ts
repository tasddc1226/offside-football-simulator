import { MemoryLocalStore } from '@offside/engine-client';
import { describe, expect, it } from 'vitest';
import { markStatsRevealed, readRevealedStats } from './revealed-stats.js';

describe('revealed-stats', () => {
  it('저장된 적 없으면 false다', async () => {
    const store = new MemoryLocalStore();
    expect(await readRevealedStats(store)).toBe(false);
  });

  it('markStatsRevealed 이후 true다', async () => {
    const store = new MemoryLocalStore();
    await markStatsRevealed(store);
    expect(await readRevealedStats(store)).toBe(true);
  });
});
