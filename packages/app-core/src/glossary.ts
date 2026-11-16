// T-11-732 용어 사전 — 축구를 잘 몰라도 게임 숫자와 축구 용어를 한 줄로 알 수 있게 한다. 웹 · 앱이 같은 묶음 · 순서를 쓴다.
// 확률 도감 화면의 '용어 사전' 칸이 전체를 펼치고, 화면 곳곳의 "?" 버튼(TermHelp)이 필요한 용어만 골라 띄운다.
// 화면 표시만 한다 — 게임 상태 · 세이브 · 난수 · 서버는 건드리지 않는다.
import { glossaryText as L } from './i18n/ko/glossary.js';

export const GLOSSARY = [
  {
    id: 'numbers',
    terms: ['ovr', 'potential', 'condition', 'morale', 'fame', 'rating', 'legendScore'],
  },
  { id: 'positions', terms: ['posFW', 'posMF', 'posDF', 'posGK'] },
  { id: 'match', terms: ['assist', 'cleanSheet', 'hatTrick', 'mom', 'topScorer', 'offside'] },
  { id: 'squad', terms: ['starter', 'rotation', 'bench', 'contract', 'transfer', 'loan'] },
  { id: 'comps', terms: ['league', 'promotion', 'cup', 'ucl', 'national', 'worldCup'] },
  { id: 'career', terms: ['military', 'exemption', 'ballon', 'hof', 'retiredNumber'] },
  { id: 'owner', terms: ['ownerTeam', 'market', 'release', 'funds'] },
] as const;

export type GlossaryGroupId = (typeof GLOSSARY)[number]['id'];
export type TermId = (typeof GLOSSARY)[number]['terms'][number];

export interface Term {
  id: TermId;
  term: string;
  desc: string;
}

/** 지금 언어로 된 용어 하나. */
export const term = (id: TermId): Term => ({ id, term: L[`t_${id}`], desc: L[`d_${id}`] });

/** 용어 사전 전체(묶음 순서 그대로). */
export const glossaryGroups = (): { id: GlossaryGroupId; name: string; terms: Term[] }[] =>
  GLOSSARY.map((g) => ({ id: g.id, name: L[`g_${g.id}`], terms: g.terms.map(term) }));

/** 화면마다 "?" 버튼이 띄우는 용어 묶음. 웹 · 앱이 같은 목록을 쓴다. */
export const TERM_HELP = {
  createPos: ['posFW', 'posMF', 'posDF', 'posGK'],
  createFocus: ['ovr', 'potential'],
  seasonPrep: ['condition', 'morale', 'fame'],
  playerProfile: ['potential', 'ovr', 'contract'],
} as const satisfies Record<string, readonly TermId[]>;
export type TermHelpKey = keyof typeof TERM_HELP;
