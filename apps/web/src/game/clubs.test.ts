import { afterEach, describe, expect, it } from 'vitest';
import { CLUBS, LEAGUES } from './data.js';
import { applyClubNames, defaultLogo, logoOf, sanitizeClubCustom } from './clubs.js';
import { expectedRank } from './comps.js';

describe('리그별 클럽 구성 (T-10-009)', () => {
  it('리그마다 실제 참가 팀 수만큼 클럽이 있다', () => {
    const want: Record<string, number> = {
      hs: 12,
      uni: 12,
      k3: 14,
      k2: 17,
      k1: 11,
      j1: 20,
      mls: 30,
      ere: 18,
      l1: 18,
      bl: 18,
      sa: 20,
      ll: 20,
      pl: 20,
    };
    for (const L of LEAGUES)
      expect(CLUBS.filter((c) => c.leagueId === L.id).length, L.id).toBe(want[L.id]);
  });
  it('클럽 id·이름이 모두 고유하고, 리그 안 전력은 +9 ~ -6 범위로 내려간다', () => {
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(CLUBS.length);
    expect(new Set(CLUBS.map((c) => c.baseName)).size).toBe(CLUBS.length);
    for (const L of LEAGUES) {
      const d = CLUBS.filter((c) => c.leagueId === L.id).map((c) => c.str - L.avg);
      expect(d[0]).toBe(9);
      expect(d[d.length - 1]).toBe(-6);
      expect(d.every((v, i) => i === 0 || v <= d[i - 1]!)).toBe(true);
    }
  });
  it('첫 시즌 예상 순위는 6팀 리그에서 예전 고정표와 같고, 큰 리그도 같은 범위다', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => expectedRank(i, 6))).toEqual([1, 3, 5, 8, 11, 14]);
    expect(expectedRank(0, 20)).toBe(1);
    expect(expectedRank(19, 20)).toBe(14);
    expect(expectedRank(-1, 20)).toBe(1);
  });
});

describe('클럽 커스터마이즈 (T-10-009)', () => {
  afterEach(() => applyClubNames({}));

  it('커스텀 이름을 CLUBS에 반영하고, 비우면 기본 이름으로 돌아간다', () => {
    applyClubNames({ 'pl-0': { name: '우리 동네 FC' } });
    expect(CLUBS.find((c) => c.id === 'pl-0')!.name).toBe('우리 동네 FC');
    applyClubNames({});
    expect(CLUBS.find((c) => c.id === 'pl-0')!.name).toBe('맨체스터 스카이블루');
  });

  it('가져온 값을 검증한다 — 없는 id·잘못된 색·긴 이름·외부 이미지 URL은 버리거나 자른다', () => {
    const map = sanitizeClubCustom({
      'pl-0': { name: '  가'.padEnd(40, '나') },
      'xx-9': { name: '없는 클럽' },
      'k1-0': {
        logo: { text: 'ABCD', bg: '#112233', fg: '#ffffff', img: 'https://evil.example/x.png' },
      },
      'k1-1': { logo: { text: 'A', bg: 'red', fg: '#ffffff' } },
    });
    expect(Object.keys(map).sort()).toEqual(['k1-0', 'pl-0']);
    expect(map['pl-0']!.name!.length).toBe(20);
    expect(map['k1-0']!.logo).toEqual({ text: 'ABC', bg: '#112233', fg: '#ffffff' });
  });

  it('로고가 없으면 이름 첫 글자 + 클럽 고유색 기본 엠블럼', () => {
    const c = { id: 'k1-3', name: 'FC 서울시티' };
    expect(defaultLogo(c).text).toBe('서');
    expect(defaultLogo(c).bg).toMatch(/^#[0-9a-f]{6}$/);
    expect(logoOf(c, { 'k1-3': { logo: { text: 'S', bg: '#000000', fg: '#ffffff' } } }).text).toBe(
      'S',
    );
  });
});
