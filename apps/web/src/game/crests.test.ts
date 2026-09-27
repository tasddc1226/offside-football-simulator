import { describe, expect, it } from 'vitest';
import { CLUBS, LEAGUES } from './data.js';
import { SANGMU } from './military.js';
import { CREST_MOTIFS, CREST_PATTERNS, CREST_SHAPES, crestOf, crestSpecCount } from './crests.js';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

describe('기본 엠블럼 (T-10-063)', () => {
  it('리그별 정의 줄 수가 클럽 수와 같다 — 순서가 어긋나면 엠블럼이 다른 클럽에 붙는다', () => {
    for (const L of LEAGUES) {
      if (L.id === 'hs' || L.id === 'uni') continue;
      expect([L.id, crestSpecCount(L.id)]).toEqual([
        L.id,
        CLUBS.filter((c) => c.leagueId === L.id).length,
      ]);
    }
  });

  it('모든 클럽(상무 포함)이 올바른 틀·패턴·상징·색으로 된 엠블럼을 갖는다', () => {
    for (const club of [...CLUBS, SANGMU]) {
      const c = crestOf(club);
      expect(c, club.id).not.toBeNull();
      expect(CREST_SHAPES[c!.shape], club.id).toBeTruthy();
      expect(CREST_PATTERNS[c!.pattern], club.id).toBeDefined();
      if (c!.motif && !c!.motif.startsWith('='))
        expect(CREST_MOTIFS[c!.motif], club.id).toBeTruthy();
      for (const v of [c!.base, c!.accent, c!.motifColor, c!.edge, c!.third].filter(Boolean))
        expect(v, club.id).toMatch(HEX);
    }
  });

  it('고교·대학은 학교 이름 첫 글자를 넣고, 이름을 바꾸면 글자도 따라간다', () => {
    expect(crestOf({ id: 'hs-0', name: '한빛고' })!.motif).toBe('=한');
    expect(crestOf({ id: 'hs-0', name: '우리고' })!.motif).toBe('=우');
  });

  it('정의가 없는 클럽은 null(글자 엠블럼으로 그린다)', () => {
    expect(crestOf({ id: 'pl-99', name: '새 클럽' })).toBeNull();
  });
});
