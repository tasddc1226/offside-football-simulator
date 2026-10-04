import { describe, expect, it } from 'vitest';
import { NATIONS } from '@offside/contracts/nations';
import { NATION_GROUPS, nationGroups } from './nationSearch.js';

describe('국적 고르기', () => {
  it('검색어가 없으면 대한민국 하나가 맨 위, 나머지는 연맹별로 모두 한 번씩', () => {
    expect(nationGroups(null)).toBe(NATION_GROUPS);
    expect(nationGroups('')).toBe(NATION_GROUPS);
    expect(NATION_GROUPS[0]).toMatchObject({ key: 'KR', label: '기본' });
    expect(NATION_GROUPS[0]!.data.map((n) => n.ko)).toEqual(['대한민국']);
    const codes = NATION_GROUPS.flatMap((g) => g.data.map((n) => n.code));
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBe(NATIONS.length);
  });

  it('연맹 안은 가나다순', () => {
    const byKo = new Intl.Collator('ko').compare;
    for (const g of NATION_GROUPS.slice(1)) {
      const names = g.data.map((n) => n.ko);
      expect(names).toEqual([...names].sort(byKo));
    }
  });

  it('검색은 한 묶음 "검색 결과 N"으로, 이름이 검색어로 시작하는 나라부터', () => {
    const [g] = nationGroups('브');
    expect(g!.key).toBe('hits');
    expect(g!.label).toBe(`검색 결과 ${g!.data.length}`);
    expect(g!.data[0]!.ko.startsWith('브')).toBe(true);
  });

  it('초성으로도 찾는다', () => {
    expect(nationGroups('ㄷㅎㅁㄱ')[0]!.data.map((n) => n.ko)).toContain('대한민국');
  });

  it('없는 나라는 빈 배열', () => {
    expect(nationGroups('없는나라이름')).toEqual([]);
  });
});
