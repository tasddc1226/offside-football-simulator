import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadHOF, saveKey } from '@offside/game/season';
import type { HofEntry } from '@offside/game/types';
import { createRetiredNumbers } from './retiredNumber.js';

afterEach(() => vi.unstubAllGlobals());

describe('server retirement awards', () => {
  it('재전송을 멱등 병합하고 대표 칭호를 유지하며 부여 거절은 위조 칭호를 지운다', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    const h = {
      id: 'career',
      name: '선수',
      score: 100,
      title: 'goals100',
      detail: { titles: [{ id: 'goals100', year: 2030 }] },
    } as HofEntry;
    saveKey('ft_hof', [h]);
    const { recordRn } = createRetiredNumbers({}, { item: null });
    const result = {
      kind: 'taken' as const,
      clubId: 'pl-0',
      club: '구단',
      number: 10,
      holder: null,
      wallOfHonor: true,
    };
    recordRn('career', result, 0);
    recordRn('career', result, 0);
    let saved = loadHOF()[0]!;
    expect(saved.title).toBe('goals100');
    expect(saved.detail?.titles?.filter((t) => t.id === 'wall_of_honor')).toHaveLength(1);
    saved.title = 'wall_of_honor';
    saveKey('ft_hof', [saved]);
    recordRn('career', { ...result, wallOfHonor: false });
    saved = loadHOF()[0]!;
    expect(saved.title).toBeUndefined();
    expect(saved.detail?.titles).toEqual([{ id: 'goals100', year: 2030 }]);
  });
});
