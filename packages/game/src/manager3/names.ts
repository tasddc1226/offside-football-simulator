// T-11-648 감독 커리어 3 선수단 이름. 라이벌 이름 풀(4 × 4)은 24명 선수단에 작아 같은 이름이 자주 겹친다.
// 저장값은 한국어, 그릴 때 화면 언어로 옮긴다(풀에 없는 이름은 라이벌 이름 풀로 옮겨 본다).
import { getLocale } from '@offside/contracts/i18n';
import { gSquadText, squadNames } from '../i18n/ko/gSquad.js';
import { rivalDisplayName } from '../rival-names.js';

const COUNTRIES = ['KR', 'JP', 'US', 'NL', 'FR', 'DE', 'IT', 'ES', 'GB'] as const;
type Pool = typeof squadNames | typeof gSquadText;
const has = (c: string): c is (typeof COUNTRIES)[number] =>
  (COUNTRIES as readonly string[]).includes(c);
const parts = (pool: Pool, country: (typeof COUNTRIES)[number]) => ({
  family: pool[`${country}Family`].split('|'),
  given: pool[`${country}Given`].split('|'),
});
const join = (country: string, family: string, given: string, locale: string) =>
  country === 'KR' && locale === 'ko'
    ? family + given
    : country === 'JP'
      ? `${family} ${given}`
      : `${given} ${family}`;

/** 나라 풀에서 한국어 저장값 이름을 하나 뽑는다. 풀에 없는 나라는 한국 이름. */
export function squadName(r: () => number, country: string): string {
  const c = has(country) ? country : 'KR';
  const pool = parts(squadNames, c);
  const at = (xs: readonly string[]) => xs[Math.floor(r() * xs.length)]!;
  return join(c, at(pool.family), at(pool.given), 'ko');
}

/** 저장된 선수 이름을 화면 언어로. */
export function squadDisplayName(name: string): string {
  const locale = getLocale();
  if (locale === 'ko') return name;
  for (const c of COUNTRIES) {
    const ko = parts(squadNames, c),
      tr = parts(gSquadText, c);
    for (let f = 0; f < ko.family.length; f++)
      for (let g = 0; g < ko.given.length; g++)
        if (join(c, ko.family[f]!, ko.given[g]!, 'ko') === name)
          return join(c, tr.family[f]!, tr.given[g]!, locale);
  }
  return rivalDisplayName(name);
}
