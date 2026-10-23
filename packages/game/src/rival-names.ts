import { getLocale } from '@offside/contracts/i18n';
import { SURNAMES, GIVEN } from './data.js';
import { pick } from './rng.js';
import { rivalNames, gRivalText } from './i18n/ko/gRival.js';
import type { GameState } from './types.js';

/** 리그 → 라이벌 이름의 나라(이름 풀 키). 없는 리그(국내 · 그 밖)는 한국 이름이다. */
export const RIVAL_COUNTRY: Record<string, string> = {
  j1: 'JP',
  mls: 'US',
  ere: 'NL',
  l1: 'FR',
  bl: 'DE',
  sa: 'IT',
  ll: 'ES',
  pl: 'GB',
};
const POOLS = ['KR', ...Object.values(RIVAL_COUNTRY)];
const parts = (pool: typeof rivalNames | typeof gRivalText, country: string) => ({
  family: pool[`${country}Family` as keyof typeof pool].split('|'),
  given: pool[`${country}Given` as keyof typeof pool].split('|'),
});
const join = (country: string, family: string, given: string, locale: string) =>
  country === 'KR' && locale === 'ko'
    ? family + given
    : country === 'JP'
      ? `${family} ${given}`
      : `${given} ${family}`;

/** T-11-475 이름 풀(나라)에서 한국어 저장값 이름을 하나 뽑는다. r은 부르는 쪽 난수원(게임 RNG를 쓰지 않을 때). */
export function poolRivalName(r: () => number, country: string): string {
  const pool = parts(rivalNames, country);
  const at = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  return join(country, at(pool.family), at(pool.given), 'ko');
}

/** 저장된(한국어) 이름이 어느 나라 풀의 이름인지. 풀에 없는 이름(옛 한국 이름)은 KR. */
export function rivalCountryOf(name: string): string {
  for (const country of POOLS) {
    const ko = parts(rivalNames, country);
    if (ko.family.some((f) => ko.given.some((g) => join(country, f, g, 'ko') === name)))
      return country;
  }
  return 'KR';
}

/** 저장된(한국어) 라이벌 이름을 지금 언어로. 풀에 없는 이름은 그대로. */
export function rivalDisplayName(name: string): string {
  if (getLocale() === 'ko') return name;
  for (const country of POOLS) {
    const ko = parts(rivalNames, country),
      tr = parts(gRivalText, country);
    for (let f = 0; f < ko.family.length; f++)
      for (let g = 0; g < ko.given.length; g++)
        if (join(country, ko.family[f]!, ko.given[g]!, 'ko') === name)
          return join(country, tr.family[f]!, tr.given[g]!, getLocale());
  }
  return name;
}

/**
 * A rival belongs to the country of the league where they first appear. Existing names stay fixed.
 * T-11-475 시대의 라이벌이 있으면 이야기 이벤트도 그 사람 이름을 쓴다. 이름 추첨(게임 RNG 소비)은 예전과 같은 때에 그대로 한다.
 */
export function rivalName(s: GameState): string {
  if (!s.flags.rivalName) {
    const country = RIVAL_COUNTRY[s.leagueId];
    let name: string;
    do {
      if (!country) name = pick(SURNAMES) + pick(GIVEN);
      else {
        const pool = parts(rivalNames, country);
        name = join(country, pick(pool.family), pick(pool.given), 'ko');
      }
    } while (name === s.name);
    s.flags.rivalName = name;
  }
  const era = s.era?.past?.[0] ?? s.era?.cur;
  return rivalDisplayName(era ? era.name : (s.flags.rivalName as string));
}
