import type { LiveEvent, LiveMap } from '@offside/contracts';
import { LEAGUE_BASE } from '@offside/contracts/club-names';
import { describe, expect, it } from 'vitest';
import {
  LIVE_MAP_H,
  LIVE_MAP_W,
  latestIn,
  liveMapDots,
  liveSpots,
  pickSpot,
  project,
  spotOfLeague,
} from './live-map.js';

const map = (leagues: [string, number][]): LiveMap => ({
  at: '2026-11-23T04:00:00.000Z',
  careers: leagues.reduce((a, [, n]) => a + n, 0),
  nations: 3,
  leagues: leagues.map(([league, n]) => ({ league, n })),
});

const season = (league: string, club = '테스트 FC'): LiveEvent => ({
  kind: 'season',
  at: '2026-11-23T04:00:00.000Z',
  name: null,
  pos: 'FW',
  club,
  league,
  apps: 30,
  goals: 10,
  assists: 3,
  cs: null,
  honor: null,
  first: false,
});

describe('홈 라이브 지도 (T-11-815)', () => {
  it('모든 리그가 틀 안의 나라 점에 놓인다', () => {
    for (const l of LEAGUE_BASE) {
      const s = liveSpots(map([[l.name, 1]]))[0]!;
      expect(s.x, l.name).toBeGreaterThan(0);
      expect(s.x, l.name).toBeLessThan(LIVE_MAP_W);
      expect(s.y, l.name).toBeGreaterThan(0);
      expect(s.y, l.name).toBeLessThan(LIVE_MAP_H);
    }
  });

  it('같은 나라 리그는 한 점으로 모으고 많은 순으로 둔다', () => {
    const spots = liveSpots(
      map([
        ['프리미어리그', 158],
        ['K리그1', 50],
        ['고교 리그', 65],
        ['K리그2', 24],
        ['J1리그', 57],
      ]),
    );
    expect(spots.map((s) => [s.code, s.n])).toEqual([
      ['LHR', 158],
      ['ICN', 139],
      ['HND', 57],
    ]);
    expect(spots[1]!.leagues.map((l) => l.league)).toEqual(['K리그1', '고교 리그', 'K리그2']);
    // 넓이로 센다: 인원이 많을수록 크지만 비례보다 덜 커진다.
    expect(spots[0]!.r).toBeGreaterThan(spots[2]!.r);
    expect(spots[0]!.r / spots[2]!.r).toBeLessThan(158 / 57);
  });

  it('한 나라가 크게 앞서도 점이 이웃 나라를 덮지 않는다(운영 11-23 분포)', () => {
    const spots = liveSpots(
      map([
        ['고교 리그', 1228],
        ['K리그1', 65],
        ['프리미어리그', 157],
        ['J1리그', 72],
      ]),
    );
    const kr = spots.find((s) => s.code === 'ICN')!;
    const jp = spots.find((s) => s.code === 'HND')!;
    expect(kr.r).toBe(9);
    expect(Math.hypot(kr.x - jp.x, kr.y - jp.y)).toBeGreaterThan(kr.r + jp.r);
    expect(Math.min(...spots.map((s) => s.r))).toBeGreaterThanOrEqual(2.6);
  });

  it('모르는 리그는 한국으로, 지도가 없으면 점도 없다', () => {
    expect(spotOfLeague('없는 리그')).toBe('ICN');
    expect(liveSpots(null)).toEqual([]);
  });

  it('고른 나라 → 최근 시즌 소식의 나라 → 가장 많은 나라 순으로 가리킨다', () => {
    const spots = liveSpots(
      map([
        ['프리미어리그', 10],
        ['J1리그', 5],
        ['라리가', 2],
      ]),
    );
    const feed = [season('J1리그', '오사카 체리핑크'), season('프리미어리그')];
    expect(pickSpot(spots, feed, 'MAD')?.code).toBe('MAD');
    expect(pickSpot(spots, feed, 'XXX')?.code).toBe('HND');
    expect(pickSpot(spots, [], null)?.code).toBe('LHR');
    expect(pickSpot([], feed, null)).toBeUndefined();
    expect(latestIn(feed, 'HND')?.club).toBe('오사카 체리핑크');
    expect(latestIn(feed, 'MAD')).toBeUndefined();
  });

  it('육지 점은 틀 안에만 찍히고 서울 · 런던 근처는 육지다', () => {
    const { d, w } = liveMapDots();
    const pts = [...d.matchAll(/M([\d.]+),([\d.]+)h0/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(pts.length).toBeGreaterThan(300);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(LIVE_MAP_W);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(LIVE_MAP_H);
    }
    expect(w).toBeGreaterThan(0);
    // 웹 style.css .live-map-board의 aspect-ratio(320 / 132)와 같아야 응답 전 자리표시가 밀리지 않는다.
    expect([LIVE_MAP_W, LIVE_MAP_H]).toEqual([320, 132]);
    const near = (lat: number, lon: number) => {
      const p = project(lat, lon);
      return pts.some(([x, y]) => Math.hypot(x! - p.x, y! - p.y) < 6);
    };
    expect(near(37.5, 127)).toBe(true);
    expect(near(51.5, -0.1)).toBe(true);
    expect(near(30, -40)).toBe(false); // 대서양 한가운데
  });
});
