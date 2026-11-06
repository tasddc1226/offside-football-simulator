import { leagueTitles } from '@offside/contracts/league-names';
import { describe, expect, it } from 'vitest';
import { leagueEmblem, leagueTrophy } from './leagueArt.js';

const ALL = [1, 2, 4, 8, 16, 32].flatMap((n, t) =>
  Array.from({ length: n }, (_, l) => ({ tier: t + 1, league: l + 1 })),
);
const sign = (a: ReturnType<typeof leagueEmblem>) =>
  a.layers.map((l) => `${l.d}|${a.palette[l.tone]}`).join(';');

describe('리그 아이콘 · 트로피', () => {
  it('이름표의 리그 수만큼 있다', () => {
    expect(ALL).toHaveLength(leagueTitles('ko').length);
  });

  it('리그마다 아이콘과 트로피가 모두 다르다', () => {
    expect(new Set(ALL.map((p) => sign(leagueEmblem(p.tier, p.league)))).size).toBe(ALL.length);
    expect(new Set(ALL.map((p) => sign(leagueTrophy(p.tier, p.league)))).size).toBe(ALL.length);
  });

  it('좌표가 숫자이고 칠할 색이 있다', () => {
    for (const p of ALL)
      for (const art of [leagueEmblem(p.tier, p.league), leagueTrophy(p.tier, p.league)])
        for (const l of art.layers) {
          expect(l.d).not.toMatch(/NaN|undefined/);
          expect(art.palette[l.tone]).toMatch(/^#[0-9a-f]{6}$/i);
        }
  });

  it('트로피에는 받침대가 있다', () => {
    for (const p of ALL)
      expect(leagueTrophy(p.tier, p.league).layers.some((l) => l.plinth)).toBe(true);
  });

  it('이름표보다 리그가 많아져도 그림을 그린다', () => {
    expect(leagueEmblem(7, 1).layers.length).toBeGreaterThan(0);
    expect(leagueTrophy(7, 40).layers.length).toBeGreaterThan(0);
  });
});
