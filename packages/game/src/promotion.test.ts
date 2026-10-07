import { describe, expect, it } from 'vitest';
import { CLUBS } from './data.js';
import { clubsIn, leagueTable, newGame, newSeason, seasonLeagueId } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import { acceptOption, endSeason, market, offerFrom } from './season.js';
import { seasonSetup } from './comps.js';
import { migrateSave } from './save.js';
import { promoteClub } from './promotion.js';
import type { GameState } from './types.js';

function k2Player(seed = 7, idx = 0): GameState {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: '승격', number: 9, pos: 'FW', foot: '오른발', focus: ['sho', 'dri'], trait: 'late' },
    1,
  );
  s.age = 24;
  s.leagueId = 'k2';
  s.club = { ...clubsIn('k2')[idx]! };
  s.contract = { years: 4, salary: 3000 };
  s.season = newSeason(s);
  return s;
}

/** 이번 시즌 대륙 대회에 나가는지(대회 편성은 첫 경기 때 한다). */
function inContinental(s: GameState) {
  if (!s.season.comps) seasonSetup(s, s.season);
  return s.season.comps!.some((c) => c.type === 'cont');
}

/** 이적 시장에서 잔류를 고르고 다음 시즌으로. */
function stay(s: GameState) {
  const m = market(s);
  acceptOption(
    s,
    m.options.find((o) => o.kind === 'stay')!,
    m.options,
  );
  return m;
}

/** 시즌을 끝까지 치른 것으로 — 승점을 크게 주면 finalRank가 1위다. */
function finishSeason(s: GameState, pts: number) {
  Object.assign(s.season, { played: 36, w: 30, d: 0, l: 6, pts, apps: 30, ratingSum: 30 * 7.2 });
}

// T-10-110 K리그2 우승 구단의 K리그1 승격
describe('K2 우승 승격', () => {
  it('K2 1위로 시즌을 마치면 구단이 K1으로 올라가고, K1 최약 구단이 K2로 내려가 팀 수가 그대로다', () => {
    const s = k2Player();
    const me = s.club.id;
    finishSeason(s, 200);
    const res = endSeason(s);

    expect(res.rec.rank).toBe(1);
    expect(res.rec.league).toBe('K리그2');
    expect(res.rec.honors).toContain('K리그2 우승');
    expect(res.promo).toEqual({ club: s.club.name, down: '부천 95' });
    // 승격은 트로피·영예로 세지 않는다(LS·서버 영예 검사).
    expect(res.trophies.some((t) => t.includes('승격'))).toBe(false);
    expect(s.leagueId).toBe('k1');

    // K1 기본 전력 최하위(k1-10 부천 95)가 내려간다.
    const down = 'k1-10';
    expect(s.leagueMoves).toEqual({ [me]: 'k1', [down]: 'k2' });
    const k1 = clubsIn('k1', s).map((c) => c.id),
      k2 = clubsIn('k2', s).map((c) => c.id);
    expect(k1).toHaveLength(clubsIn('k1').length);
    expect(k2).toHaveLength(clubsIn('k2').length);
    expect(k1).toContain(me);
    expect(k1).not.toContain(down);
    expect(k2).toContain(down);
    expect(k2).not.toContain(me);
    expect(s.log.some((l) => l.text.includes('K리그1 승격 확정'))).toBe(true);
  });

  it('승격 직후 이적 시장이 떠 있는 동안 순위표는 끝난 K2 시즌 그대로, 잔류하면 새 시즌은 K1 표다', () => {
    const s = k2Player();
    finishSeason(s, 200);
    endSeason(s);
    expect(s.leagueId).toBe('k1');
    expect(seasonLeagueId(s)).toBe('k2');
    const rows = leagueTable(s);
    expect(rows).toHaveLength(clubsIn('k2').length);
    expect(rows.find((r) => r.me)!.pts).toBe(200);
    // T-11-134 끝난 시즌 표는 그 시즌에 실제로 상대한 K2 구단 그대로다(새로 강등된 K1 구단이 끼지 않는다).
    expect(rows.some((r) => r.id === 'k1-10')).toBe(false);
    expect(rows.filter((r) => !r.me).every((r) => r.id?.startsWith('k2-'))).toBe(true);
    stay(s);
    expect(s.season.leagueId).toBeUndefined();
    expect(seasonLeagueId(s)).toBe('k1');
  });

  it('2위 이하·K1·아마추어 리그는 승격하지 않는다', () => {
    const s = k2Player();
    expect(promoteClub(s, 2)).toBeUndefined();
    s.leagueId = 'k1';
    s.club = { ...clubsIn('k1')[0]! };
    expect(promoteClub(s, 1)).toBeUndefined();
    s.leagueId = 'k3';
    s.club = { ...clubsIn('k3')[0]! };
    expect(promoteClub(s, 1)).toBeUndefined();
    expect(s.leagueMoves).toBeUndefined();
  });

  it('잔류하면 다음 시즌 K1 순위표에 내 구단이 들어가고, 승격 첫해는 대륙 대회에 나가지 않는다', () => {
    const s = k2Player();
    finishSeason(s, 200);
    endSeason(s);
    const m = stay(s);
    expect(m.note).toContain('K리그1 승격');
    expect(m.options.find((o) => o.kind === 'stay')!.desc).toContain('K리그1 도전');

    expect(s.leagueId).toBe('k1');
    expect(inContinental(s)).toBe(false);
    Object.assign(s.season, { played: 10, w: 5, d: 2, l: 3, pts: 17 });
    const rows = leagueTable(s);
    expect(rows).toHaveLength(clubsIn('k1').length);
    expect(rows.filter((r) => r.id === s.club.id)).toHaveLength(1);
    expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
    expect(rows.some((r) => r.id === 'k1-10')).toBe(false);
  });

  it('두 번째 K1 시즌부터는 지난 K1 순위로 대륙 대회 자격을 따진다', () => {
    const s = k2Player();
    finishSeason(s, 200);
    endSeason(s);
    stay(s);
    finishSeason(s, 300);
    Object.assign(s.season, { played: 38 });
    const res = endSeason(s);
    expect(res.rec.league).toBe('K리그1');
    expect(res.rec.rank).toBe(1);
    expect(res.promo).toBeUndefined();
    expect(stay(s).note).not.toContain('승격');
    expect(inContinental(s)).toBe(true);
  });

  it('승격한 구단으로 이적하면 그 구단의 지금 리그(K1)로 간다 — 떠난 뒤에도 승격은 유지된다', () => {
    const s = k2Player();
    const promotedId = s.club.id;
    finishSeason(s, 200);
    endSeason(s);
    s.club = { ...clubsIn('k2', s)[3]! };
    s.leagueId = 'k2';
    const target = CLUBS.find((c) => c.id === promotedId)!;
    const offer = offerFrom(s, target);
    expect(offer.leagueId).toBe('k1');
    acceptOption(s, offer);
    expect(s.leagueId).toBe('k1');
    expect(s.club.id).toBe(promotedId);
  });

  it('승강 정보는 저장·복구 뒤에도 남고, 필드가 없는 옛 저장은 정적 소속으로 읽는다', () => {
    const s = k2Player();
    finishSeason(s, 200);
    endSeason(s);
    const G = JSON.parse(JSON.stringify(s)) as GameState;
    migrateSave(G);
    expect(G.leagueMoves).toEqual(s.leagueMoves);
    expect(clubsIn('k1', G).map((c) => c.id)).toEqual(clubsIn('k1', s).map((c) => c.id));

    const old = JSON.parse(JSON.stringify(k2Player(9, 2))) as GameState;
    delete old.leagueMoves;
    migrateSave(old);
    expect(clubsIn('k2', old).map((c) => c.id)).toEqual(clubsIn('k2').map((c) => c.id));
  });
});
