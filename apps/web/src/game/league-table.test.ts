import { describe, expect, it } from 'vitest';
import { LEAGUES } from './data.js';
import { clubsIn, finalRank, leagueTable, newGame, newSeason, teamRank } from './engine.js';
import { createRng, setActiveRng } from './rng.js';

// T-10-024: 순위표는 리그의 실제 팀 수만큼, 순위는 순위표와 같은 값이어야 한다.
describe('리그 순위표', () => {
  for (const L of LEAGUES) {
    it(`${L.name}: 팀 수·승무패·승점이 맞고 내 순위가 teamRank와 같다`, () => {
      setActiveRng(createRng(L.tier * 100 + L.matches));
      const s = newGame({ name: '표', number: 9, pos: 'FW', foot: '오른발', focus: ['sho', 'dri'], trait: 'late' }, 1);
      s.leagueId = L.id;
      s.club = clubsIn(L.id)[3]!;
      s.season = newSeason(s);
      Object.assign(s.season, { played: 10, w: 5, d: 2, l: 3, pts: 17 });

      const rows = leagueTable(s);
      // 상대 전력은 시즌마다 19개라 30팀인 MLS는 20팀까지만 보여 준다.
      const size = Math.min(clubsIn(L.id).length, 20);
      expect(rows).toHaveLength(size);
      expect(rows.filter((r) => r.me)).toHaveLength(1);
      expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
      for (const r of rows) {
        expect(r.w + r.d + r.l).toBe(10);
        expect(3 * r.w + r.d).toBe(r.pts);
        expect(Math.min(r.w, r.d, r.l)).toBeGreaterThanOrEqual(0);
      }
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1]!.pts).toBeGreaterThanOrEqual(rows[i]!.pts);
      expect(teamRank(s)).toBe(rows.findIndex((r) => r.me) + 1);

      Object.assign(s.season, { played: L.matches, pts: 40 });
      for (let i = 0; i < 20; i++) expect(finalRank(s)).toBeLessThanOrEqual(size);
    });
  }
});
