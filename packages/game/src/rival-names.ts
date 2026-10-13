import { getLocale } from '@offside/contracts/i18n';
import { SURNAMES, GIVEN } from './data.js';
import { pick } from './rng.js';
import { rivalNames, gRivalText } from './i18n/ko/gRival.js';
import type { GameState } from './types.js';

const COUNTRY: Record<string, string> = {
  j1: 'JP',
  mls: 'US',
  ere: 'NL',
  l1: 'FR',
  bl: 'DE',
  sa: 'IT',
  ll: 'ES',
  pl: 'GB',
};
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

/** A rival belongs to the country of the league where they first appear. Existing names stay fixed. */
export function rivalName(s: GameState): string {
  if (!s.flags.rivalName) {
    const country = COUNTRY[s.leagueId];
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
  const name = s.flags.rivalName as string;
  if (getLocale() === 'ko') return name;
  for (const country of Object.values(COUNTRY)) {
    const ko = parts(rivalNames, country),
      tr = parts(gRivalText, country);
    for (let f = 0; f < ko.family.length; f++)
      for (let g = 0; g < ko.given.length; g++)
        if (join(country, ko.family[f]!, ko.given[g]!, 'ko') === name)
          return join(country, tr.family[f]!, tr.given[g]!, getLocale());
  }
  return name;
}
