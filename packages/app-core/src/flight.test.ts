import { describe, expect, it } from 'vitest';
import { alongRoute, crossesBorder, flightHours, hubOf } from './flight.js';
import { flightMap } from './flight-map.js';
import { flightProgress } from './flight-time.js';
import { landAt } from './land.js';

describe('land', () => {
  it('육지와 바다를 구분한다', () => {
    // 1도 칸 가운데로 보므로 해안 도시 대신 내륙을 본다.
    expect(landAt(36, 128)).toBe(true); // 한국
    expect(landAt(52, 0)).toBe(true); // 잉글랜드
    expect(landAt(39, -100)).toBe(true); // 미국
    expect(landAt(39, 260)).toBe(true); // 경도를 감아서
    expect(landAt(30, -40)).toBe(false); // 대서양
    expect(landAt(20, 160)).toBe(false); // 태평양
    expect(landAt(85, 0)).toBe(false); // 격자 밖
  });
});

describe('flight', () => {
  it('리그를 나라 공항으로 바꾼다', () => {
    expect(hubOf('k1').code).toBe('ICN');
    expect(hubOf('hs').code).toBe('ICN');
    expect(hubOf('pl').code).toBe('LHR');
    expect(hubOf('mls').code).toBe('JFK');
    expect(crossesBorder('k3', 'k1')).toBe(false);
    expect(crossesBorder('hs', 'j1')).toBe(true);
    expect(crossesBorder('ll', 'pl')).toBe(true);
  });

  it.each([
    ['k1', 'pl'],
    ['k1', 'mls'],
    ['pl', 'mls'],
    ['ere', 'l1'],
    ['j1', 'k1'],
  ])('%s → %s 경로가 화면 안에 들어오고 한쪽으로 휜다', (a, b) => {
    const m = flightMap(hubOf(a), hubOf(b), 320, 190);
    for (const p of [m.from, m.to]) {
      expect(p.x).toBeGreaterThan(20);
      expect(p.x).toBeLessThan(300);
      expect(p.y).toBeGreaterThan(20);
      expect(p.y).toBeLessThan(170);
    }
    // 꼭짓점이 두 공항을 잇는 직선에서 비켜나 있고(휜다) 화면 안이다.
    const apex = alongRoute(m, 0.5);
    const mid = { x: (m.from.x + m.to.x) / 2, y: (m.from.y + m.to.y) / 2 };
    expect(Math.hypot(apex.x - mid.x, apex.y - mid.y)).toBeGreaterThan(5);
    expect(apex.y).toBeLessThanOrEqual(mid.y);
    expect(apex.y).toBeGreaterThan(0);
    expect(m.dots.length).toBeGreaterThan(200);
  });

  it('비행시간을 어림한다', () => {
    expect(flightHours(hubOf('k1'), hubOf('pl'))).toBe(10);
    expect(flightHours(hubOf('ere'), hubOf('l1'))).toBe(1);
  });

  it('인천 → 뉴욕은 태평양을 건넌다(동쪽으로)', () => {
    const m = flightMap(hubOf('k1'), hubOf('mls'));
    expect(m.to.x).toBeGreaterThan(m.from.x);
  });

  it('진행률은 이륙 전 0, 착륙 뒤 1, 그 사이에서 늘어난다', () => {
    expect(flightProgress(0)).toBe(0);
    expect(flightProgress(3000)).toBe(1);
    expect(flightProgress(1000)).toBeLessThan(flightProgress(2000));
  });
});
