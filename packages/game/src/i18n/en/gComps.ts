import type { Translation } from '@offside/contracts/i18n';
import type { GCompsMsgs } from '../ko/gComps';
import { tn } from '../names';

const ROUND: Record<string, string> = {
  '32강': 'round of 32',
  '16강': 'round of 16',
  '8강': 'quarter-finals',
  '4강': 'semi-finals',
  결승: 'final',
  '녹아웃 PO': 'knockout play-off',
  '리그 페이즈': 'league phase',
  '1라운드': 'first round',
};
const round = (k: string) => ROUND[k] ?? k;

export const gComps: Translation<GCompsMsgs> = {
  compLine: (p) => {
    const st = p.stage;
    if (st === '우승') return `${p.name}: winners!`;
    if (st === '준우승') return `${p.name}: runners-up`;
    let m = /^(.+) 탈락$/.exec(st);
    if (m) return `${p.name}: knocked out in the ${round(m[1]!)}`;
    m = /^(.+) 통과$/.exec(st);
    if (m) return `${p.name}: through the ${round(m[1]!)}`;
    m = /^(.+) 진출$/.exec(st);
    if (m) return `${p.name}: into the ${round(m[1]!)}`;
    return `${p.name}: ${tn(p.stage)}`;
  },
  contKoPass: (p) => `${p.name}: through the first round, into the round of 16`,
  leagueDirect: (p) =>
    `${p.name}: through the league phase, straight into the round of 16 (${p.pts} pts)`,
  leaguePlayoff: (p) => `${p.name}: into the knockout play-off (${p.pts} pts)`,
  leagueOut: (p) => `${p.name}: out in the league phase (${p.pts} pts)`,
  galaWin: 'You won the Ballon d’Or!',
  galaRank: (p) => `Ballon d’Or: ${p.rank}${ord(p.rank)} (30-man shortlist)`,
};
function ord(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
}
