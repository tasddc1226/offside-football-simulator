import { beforeEach, describe, expect, it } from 'vitest';
import { saveKey, loadKey } from './season.js';
import { newGame } from './engine.js';
import { createRng, setActiveRng } from './rng.js';

// vitest의 node 환경에는 localStorage가 없다 — saveKey/loadKey가 쓰는 만큼만 메모리로 흉내낸다.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('저장/불러오기 라운드트립', () => {
  it('저장한 상태를 그대로 복원한다', () => {
    setActiveRng(createRng(7));
    const g = newGame({ name: '홍길동', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 7);
    saveKey('ft_save', g);
    const loaded = loadKey<typeof g>('ft_save');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('홍길동');
    expect(loaded!.attrs).toEqual(g.attrs);
    expect(loaded!.sub).toEqual(g.sub);
    expect(loaded!.rng).toEqual({ seed: 7 });
  });

  it('구버전 저장(sub/rng 없음)도 파싱은 그대로 성공한다 — 마이그레이션은 ui.ts 로드 시점 책임', () => {
    const legacySave = {
      v: 1,
      name: '옛날선수',
      pos: 'MF',
      attrs: { pac: 60, sho: 55, pas: 65, dri: 60, def: 50, phy: 58 },
      // sub, rng, seasonStartSub, bloom, halves 필드가 없는 옛 저장 형식
    };
    saveKey('ft_save', legacySave);
    const loaded = loadKey<typeof legacySave>('ft_save');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('옛날선수');
    expect((loaded as Record<string, unknown>).sub).toBeUndefined();
    expect((loaded as Record<string, unknown>).rng).toBeUndefined();
  });

  it('없는 키를 불러오면 null', () => {
    expect(loadKey('nope')).toBeNull();
  });

  it('명예의 전당 데이터는 ft_hof 키로 남는다', () => {
    const hof = [{ name: 'A', score: 100 }];
    saveKey('ft_hof', hof);
    expect(loadKey('ft_hof')).toEqual(hof);
  });
});

describe('T-10-005 은퇴 스냅샷', () => {
  it('서버 계약(LegendSnapshotSchema)을 통과하고 CareerRecord 부가 필드는 빠진다', async () => {
    const { LegendSnapshotSchema } = await import('@offside/contracts');
    const { legendSnapshot } = await import('./season.js');
    setActiveRng(createRng(3));
    const g = newGame({ name: '스냅샷', number: 11, pos: 'DF', foot: '왼발', type: 'stopper', trait: 'late' }, 3);
    g.career.push({ year: 2026, age: 18, club: 'A', league: '고교리그', apps: 10, goals: 1, assists: 2, cs: 4, lgApps: 8, rating: 7, rank: 2, ovr: 60, honors: [], pro: false, comps: [], ch: ['cs'] } as never);
    g.trophies.push({ year: 2026, t: '우승', club: 'A' });
    const snap = legendSnapshot(g);
    expect(() => LegendSnapshotSchema.parse(snap)).not.toThrow();
    expect(snap.career[0]).not.toHaveProperty('lgApps');
    expect(snap.career[0]).not.toHaveProperty('comps');
    expect(snap).not.toHaveProperty('name');
  });
});
