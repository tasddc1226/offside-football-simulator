import { describe, expect, it } from 'vitest';
import { playCareer } from '@offside/game/__fixtures__/play-career';
import type { EraNote } from '@offside/game/era';
import type { CareerRecord, GameState } from '@offside/game/types';
import { eraCard, eraTab } from './era-view';

const withEra = (): GameState => {
  for (let i = 0; i < 64; i++) {
    const s = playCareer(i);
    if (s.era) return s;
  }
  throw new Error('no rival');
};

describe('시대의 라이벌 화면 (T-11-475)', () => {
  it('트로피 탭: 라이벌이 없으면 없고, 있으면 통산 비교 · 시즌 기록을 그린다', () => {
    expect(eraTab({ pos: 'FW', career: [], awards: [] })).toBeNull();
    const s = withEra();
    const v = eraTab(s)!;
    expect(v.who.name).toBeTruthy();
    expect(v.rows).toHaveLength(7);
    expect(v.seasons).toHaveLength(s.era!.cur.seasons.length);
    expect(v.verdict).toMatch(/앞서|팽팽/);
  });

  it('결산 카드: 이긴 칸 표시 · 라이벌 발롱도르 수상 줄 · 수비수는 골 대신 무실점', () => {
    const rec = {
      year: 2030,
      apps: 30,
      goals: 3,
      assists: 2,
      cs: 12,
      rating: 7.1,
      ovr: 80,
    } as CareerRecord;
    const note: EraNote = {
      kind: 'new',
      name: '레온 피셔',
      country: 'DE',
      pos: 'DF',
      age: 22,
      rival: {
        year: 2030,
        age: 22,
        club: '도르트문트',
        clubId: 'bl-3',
        league: '분데스리가',
        apps: 32,
        goals: 2,
        assists: 1,
        cs: 9,
        rating: 7.3,
        ovr: 82,
        rank: 2,
        honors: ['발롱도르'],
        ballon: 1, // i18n-ignore 저장값
      },
    };
    const v = eraCard({ pos: 'DF', awards: [], ballon: [{ year: 2030, rank: 4 }] }, note, rec);
    expect(v.rows.map((r) => r.label)).toContain('무실점');
    expect(v.rows.find((r) => r.label === 'OVR')!.win).toBe(-1);
    expect(v.rows.find((r) => r.label === '발롱도르')).toMatchObject({
      me: '4위',
      rival: '1위',
      win: -1,
    });
    expect(v.ballon).toContain('레온 피셔');
    expect(v.who.flag).toBe('🇩🇪');
    expect(v.intro).toBeTruthy();
  });
});
