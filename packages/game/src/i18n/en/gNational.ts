import type { Translation } from '@offside/contracts/i18n';
import type { GNationalMsgs } from '../ko/gNational';

const RIVAL: Record<string, string> = {
  한일전: 'Korea-Japan derby',
  '남미 최고의 라이벌전': 'South American rivalry',
  '잉글랜드-독일전': 'England v Germany',
  '독일-네덜란드전': 'Germany v Netherlands',
  '네덜란드-독일전': 'Netherlands v Germany',
  '이베리아 더비': 'Iberian derby',
  '프랑스-이탈리아전': 'France v Italy',
  '이탈리아-프랑스전': 'Italy v France',
  '북중미 라이벌전': 'North American rivalry',
};
const MONTH: Record<number, string> = { 3: 'March', 9: 'September', 10: 'October', 11: 'November' };
const REGION: Record<string, string> = {
  AFC: 'Asia',
  UEFA: 'Europe',
  CONMEBOL: 'South America',
  CAF: 'Africa',
  CONCACAF: 'North and Central America',
  OFC: 'Oceania',
};
const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

export const gNational: Translation<GNationalMsgs> = {
  rivalLabel: (p) => RIVAL[p.ko] ?? 'Big rivalry',
  rivalWin: (p) =>
    `${p.label} win!${p.g ? ` Your ${n(p.g, 'goal', 'goals')} made you a national hero.` : ' You became a national hero.'}`,
  debut: (p) => `Your first senior international call-up! (${p.name})`,
  windowName: (p) => `${MONTH[p.m] ?? `Month ${p.m}`} internationals`,
  friendly: 'International friendly',
  wcQual: (p) => `${p.year} World Cup qualifiers (${REGION[p.conf] ?? p.region})`,
  score: (p) => `${p.team} ${p.kg}-${p.og} ${p.opp}${p.pso ? ` (${p.pso} on penalties)` : ''}`,
  matchLog: (p) =>
    `[${p.comp}] ${p.score}${
      p.mins
        ? ` · ${p.mins} min${p.g ? `, ${n(p.g, 'goal', 'goals')}` : ''}${p.a ? `, ${n(p.a, 'assist', 'assists')}` : ''}`
        : ' · Unused sub'
    }`,
  captain: 'You were named national team captain.',
  whyInjury: 'Missed the final squad through injury',
  whyCut: 'Cut from the final squad',
  whyRefused: 'Your club refused to release you',
  whyWildcard: 'Picked as an over-age wildcard',
};
