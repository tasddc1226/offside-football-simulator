import { describe, expect, it } from 'vitest';
import { ACH_GRADES } from '@offside/contracts/owner-team';
import { EMBLEM_PALETTE, gradeEmblem } from './gradeEmblem';

const coords = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

describe('gradeEmblem', () => {
  it('모든 등급이 64×64 안에 그려지고 팔레트에 있는 색만 쓴다', () => {
    for (const g of ACH_GRADES) {
      const { layers, palette } = gradeEmblem(g.id);
      expect(palette).toBe(EMBLEM_PALETTE[g.id]);
      expect(layers.length).toBeGreaterThan(3);
      for (const l of layers) {
        expect(l.d).toMatch(/^M[\d. L-]+z$/);
        for (const n of coords(l.d)) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(64);
        }
        expect(palette[l.tone]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('등급이 오를수록 장식(레이어)이 줄지 않는다', () => {
    const n = ACH_GRADES.map((g) => gradeEmblem(g.id).layers.length);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeGreaterThanOrEqual(n[i - 1]!);
  });

  it('모르는 등급은 루키 엠블럼', () => {
    expect(gradeEmblem('nope')).toEqual(gradeEmblem('rookie'));
  });
});
