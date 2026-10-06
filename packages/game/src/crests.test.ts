import { describe, expect, it } from 'vitest';
import { CLUBS, LEAGUES } from './data.js';
import { SANGMU } from './military.js';
import { CREST_MOTIFS, CREST_SPECS, crestOf } from './crests.js';

const HEX6 = /^#[0-9a-f]{6}$/i;

describe('기본 엠블럼 (T-10-063)', () => {
  it('리그별 정의 줄 수가 클럽 수와 같다(정의가 있는 리그)', () => {
    for (const L of LEAGUES) {
      const rows = CREST_SPECS[L.id];
      if (rows)
        expect([L.id, rows.length]).toEqual([
          L.id,
          CLUBS.filter((c) => c.leagueId === L.id).length,
        ]);
    }
  });

  it('정의 순서가 클럽 이름 순서와 맞는다 — 리그마다 한 팀씩 상징으로 짚는다', () => {
    const motif = (baseName: string) => {
      const c = crestOf(CLUBS.find((x) => x.baseName === baseName)!);
      return c.text ?? Object.keys(CREST_MOTIFS).find((k) => CREST_MOTIFS[k]!.d === c.icon?.d);
    };
    expect(
      [
        '당진 해나루',
        '파주 보더라인',
        '부천 95',
        '미토 접시꽃',
        '댈러스 후프스',
        '폴렌담 어부들',
        '메스 그르나',
        '함부르크 해적깃발',
        '베로나 스칼리제리',
        '오비에도 카르바요네스',
        '런던 해머스',
        '번리 클라레츠',
      ].map(motif),
    ).toEqual([
      'sun',
      'P',
      '95',
      'flower',
      undefined,
      'fish',
      'cross',
      'flag',
      'V',
      'tree',
      'hammer',
      undefined,
    ]);
  });

  it('모든 클럽(상무 포함)이 6자리 색으로 된 엠블럼을 갖는다 — 로고 편집(input[type=color])이 이 색에서 시작한다', () => {
    for (const club of [...CLUBS, SANGMU]) {
      const c = crestOf(club);
      for (const v of [c.base, c.accent, c.motifColor, c.edge, c.third].filter(Boolean))
        expect(v, club.id).toMatch(HEX6);
    }
  });

  it('정의가 없는 클럽(고교·대학 등)은 이름 첫 글자 자동 엠블럼 — 이름을 바꾸면 글자도 따라간다', () => {
    expect(crestOf({ id: 'hs-0', name: '한빛고' }).text).toBe('한');
    expect(crestOf({ id: 'hs-0', name: '우리고' }).text).toBe('우');
    expect(crestOf({ id: 'pl-99', name: 'FC 새 클럽' }).text).toBe('새');
  });
});
