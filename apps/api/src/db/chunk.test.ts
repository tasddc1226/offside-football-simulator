import { describe, expect, it } from 'vitest';
import { chunksOf, D1_IN_CHUNK, readInChunks } from './chunk.js';

describe('chunksOf', () => {
  it('순서를 지키며 한도 안으로 나눈다', () => {
    expect(chunksOf([])).toEqual([]);
    expect(chunksOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    const xs = Array.from({ length: 128 }, (_, i) => i);
    const parts = chunksOf(xs);
    expect(parts.map((p) => p.length)).toEqual([D1_IN_CHUNK, 128 - D1_IN_CHUNK]);
    expect(parts.flat()).toEqual(xs);
    expect(D1_IN_CHUNK).toBeLessThan(100);
  });
});

describe('readInChunks', () => {
  it('중복을 빼고 나눠 읽은 행을 모두 잇는다', async () => {
    const seen: number[][] = [];
    const rows = await readInChunks([...Array(101).keys(), 0, 1], async (c) => {
      seen.push(c);
      return c.map((x) => x * 2);
    });
    expect(seen.map((c) => c.length)).toEqual([90, 11]);
    expect(rows).toEqual([...Array(101).keys()].map((x) => x * 2));
  });

  it('값이 없으면 읽지 않는다', async () => {
    let calls = 0;
    expect(await readInChunks([], async () => [++calls])).toEqual([]);
    expect(calls).toBe(0);
  });
});
