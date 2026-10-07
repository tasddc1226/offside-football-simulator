import { describe, expect, it } from 'vitest';
import { LEAGUES } from './data.js';
import {
  clubsIn,
  finalRank,
  leagueOf,
  leagueTable,
  newGame,
  newSeason,
  teamRank,
} from './engine.js';
import { clamp, createRng, gauss, getActiveRng, setActiveRng } from './rng.js';
import { endSeason } from './season.js';

// T-10-024: 순위표는 리그의 실제 팀 수만큼, 순위는 순위표와 같은 값이어야 한다.
describe('리그 순위표', () => {
  for (const L of LEAGUES) {
    it(`${L.name}: 팀 수·승무패·승점이 맞고 내 순위가 teamRank와 같다`, () => {
      setActiveRng(createRng(L.tier * 100 + L.matches));
      const s = newGame(
        { name: '표', number: 9, pos: 'FW', foot: '오른발', focus: ['sho', 'dri'], trait: 'late' },
        1,
      );
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
      for (let i = 1; i < rows.length; i++)
        expect(rows[i - 1]!.pts).toBeGreaterThanOrEqual(rows[i]!.pts);
      expect(teamRank(s)).toBe(rows.findIndex((r) => r.me) + 1);

      Object.assign(s.season, { played: L.matches, pts: 40 });
      for (let i = 0; i < 20; i++) expect(finalRank(s)).toBe(teamRank(s));
    });
  }

  function completedEpl() {
    setActiveRng(createRng(7));
    const s = newGame(
      { name: '표', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      7,
    );
    s.leagueId = 'pl';
    s.club = { ...clubsIn('pl')[0]! };
    s.season = newSeason(s);
    const L = leagueOf('pl');
    Object.assign(s.season, { played: 38, w: 24, d: 5, l: 9, pts: 77 });
    s.season.rivals.fill(L.avg - 20);
    // 기본 기대 승점 75, 표의 편차를 더해도 내 77점을 넘지 않는다.
    s.season.rivals[0] = L.avg + (75 / 38 - 1.35) / 0.06;
    return s;
  }

  it('38경기를 마친 1위는 결산 RNG가 달라도 같은 1위이며 결산 뒤 표도 같다', () => {
    const s = completedEpl();
    const rows = leagueTable(s);
    expect(teamRank(s)).toBe(1);
    for (let seed = 1; seed <= 100; seed++) {
      setActiveRng(createRng(seed));
      expect(finalRank(s)).toBe(1);
    }
    const result = endSeason(s);
    expect(result.rec.rank).toBe(1);
    expect(result.trophies).toContain(`${leagueOf('pl').name} 우승`);
    expect(leagueTable(s)).toEqual(rows);
    expect(s.season.finalTable).toEqual(rows);
  });

  it('승점이 같으면 표와 결산 모두 내 팀을 위에 둔다', () => {
    const s = completedEpl();
    s.season.pts = Math.max(
      ...leagueTable(s)
        .filter((row) => !row.me)
        .map((row) => row.pts),
    );
    expect(leagueTable(s)[0]!.me).toBe(true);
    for (let seed = 1; seed <= 100; seed++) {
      setActiveRng(createRng(seed));
      expect(finalRank(s)).toBe(1);
    }
  });

  it('상대 구단이 없는 옛 시즌도 결산 후 연도·구단 변경과 반환 행 수정에 흔들리지 않는다', () => {
    const s = completedEpl();
    delete s.season.opp;
    const rows = leagueTable(s);
    const rank = teamRank(s);
    expect(endSeason(s).rec.rank).toBe(rank);
    s.year += 2; // 결산 뒤 병역 등으로 연도가 더 바뀌어도 그대로다.
    s.club.name = '변경';
    const returned = leagueTable(s);
    returned[0]!.pts = -1;
    returned.reverse();
    expect(leagueTable(s)).toEqual(rows);
    s.season = newSeason(s);
    expect(s.season.finalTable).toBeUndefined();
    expect(leagueTable(s).find((row) => row.me)!.pts).toBe(0);
  });

  it('표로 정산해도 기존 결산의 상대 전체·동점 난수 소비를 보존한다', () => {
    const s = completedEpl();
    const L = leagueOf(s.leagueId);
    s.season.rivals.fill(L.avg);
    s.season.pts = Math.round(L.matches * 1.35);
    let ties = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const legacy = createRng(seed);
      for (const str of s.season.rivals) {
        const pts = Math.round(
          L.matches * clamp(1.35 + (str - L.avg) * 0.06 + gauss(legacy.next) * 0.12, 0.4, 2.6),
        );
        if (pts === s.season.pts) {
          ties++;
          legacy.next();
        }
      }
      setActiveRng(createRng(seed));
      finalRank(s);
      expect(getActiveRng().getState()).toEqual(legacy.getState());
    }
    expect(ties).toBeGreaterThan(0);
  });
});
