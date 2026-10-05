import type { FirstsResponse, TickerFirst } from '@offside/contracts';
import { CONFEDS, CONF_ORDER } from '@offside/contracts/nations';
import { retireAtOf, nextRetireAt } from '@offside/contracts/service-seasons';
import type { Lang } from './lang.js';

// T-11-106 서버 최초 기록·서버 기록 문구의 영어. 판정(firsts.ts)은 한국어 문장과 id를 그대로 만들고, 응답을 보낼 때
// id로 문장만 바꾼다 — 엣지 캐시·기록 행·판정에 영향이 없다(캐시는 한국어 원본을 담고 읽은 뒤에 바꾼다).
const n = (v: number) => v.toLocaleString('en-US');

/** 단계 기록(id = key + 값)의 문장. key는 firsts.ts의 단계 key와 같다. */
const LADDER: Record<string, (v: number) => string> = {
  goals: (v) => `First to ${n(v)} career goals!`,
  assists: (v) => `First to ${n(v)} career assists!`,
  apps: (v) => `First to ${n(v)} career appearances!`,
  cs: (v) => `First to ${n(v)} career clean sheets!`,
  caps: (v) => `First to ${v} international caps!`,
  trophies: (v) => `First to ${v} trophies!`,
  awards: (v) => `First to ${v} individual awards!`,
  sgoals: (v) => `First to ${v} goals in a season!`,
  sassists: (v) => `First to ${v} assists in a season!`,
  scs: (v) => `First to ${v} clean sheets in a season!`,
  ovr: (v) => `First to reach ${v} OVR!`,
  age: (v) => `First to play at age ${v}!`,
  oneclub: (v) => `First to ${v} seasons at one club!`,
  leagues: (v) => `First to play in ${v} leagues!`,
  ballon: (v) => (v === 1 ? "First Ballon d'Or winner!" : `First to ${v} Ballon d'Or awards!`),
  leaguewins: (v) => `First to ${v} league titles!`,
  legend: (v) => `First to retire with ${n(v)} legend points!`,
};

const WON = (what: string) => `First to win the ${what}!`;
/** 한 번 달성하는 기록의 문장(id별). */
const FIXED: Record<string, string> = {
  srating80: 'First to average an 8.0 rating in a season!',
  srating85: 'First to average an 8.5 rating in a season!',
  teen20: 'First to score 20 goals in a season aged 20 or under!',
  goldenshoe: WON('European Golden Shoe'),
  yashin: WON('Yashin Trophy'),
  thebest: WON("FIFA The Best Men's Player award"),
  kopa: WON('Kopa Trophy'),
  muller: WON('Gerd Müller Trophy'),
  fifpro: WON('FIFPRO World 11'),
  ucl: WON('UEFA Champions League'),
  uel: WON('UEFA Europa League'),
  acle: WON('AFC Champions League Elite'),
  cwc: WON('FIFA Club World Cup'),
  wc: WON('FIFA World Cup'),
  olympic: 'First Olympic gold medal!',
  asiangames: 'First Asian Games gold medal!',
  win_pl: 'First Premier League title!',
  win_ll: 'First La Liga title!',
  win_sa: 'First Serie A title!',
  win_bl: 'First Bundesliga title!',
  win_l1: 'First Ligue 1 title!',
  win_k1: 'First K League 1 title!',
  treble: 'First treble!',
};
const CUP_EN: Record<string, string> = {
  asiancup: 'AFC Asian Cup',
  euro: 'UEFA Euro',
  copa: 'Copa América',
  afcon: 'Africa Cup of Nations',
  goldcup: 'CONCACAF Gold Cup',
  ofcup: 'OFC Nations Cup',
};
for (const c of CONF_ORDER) FIXED[CONFEDS[c].title.id] = WON(CUP_EN[CONFEDS[c].title.id] ?? '');

/** 서버 기록(id = 단계 key)의 이름과 단위. 단위는 숫자 바로 뒤에 붙으므로 앞에 공백을 둔다. */
const RECORD: Record<string, { label: string; unit: string }> = {
  goals: { label: 'Most career goals', unit: ' goals' },
  assists: { label: 'Most career assists', unit: ' assists' },
  apps: { label: 'Most career appearances', unit: ' matches' },
  cs: { label: 'Most career clean sheets', unit: ' matches' },
  caps: { label: 'Most international caps', unit: ' matches' },
  trophies: { label: 'Most trophies', unit: ' trophies' },
  awards: { label: 'Most individual awards', unit: ' awards' },
  sgoals: { label: 'Most goals in a season', unit: ' goals' },
  sassists: { label: 'Most assists in a season', unit: ' assists' },
  scs: { label: 'Most clean sheets in a season', unit: ' matches' },
  ballon: { label: "Most Ballon d'Or awards", unit: ' awards' },
  legend: { label: 'Highest legend score', unit: ' pts' },
};

/** 최초 기록 id → 영어 문장. 모르는 id면 null. season은 시즌마다 다른 기록(은퇴 나이)에 쓴다. */
export function firstLabelEn(id: string, season?: number): string | null {
  if (id === 'retirecap') {
    if (season === undefined) return 'First to retire at the retirement age!';
    const cap = retireAtOf(season);
    const next = nextRetireAt(cap, true);
    return next > cap
      ? `First to retire at ${cap}! Next season's retirement age rises to ${next}`
      : `First to retire at ${cap}!`;
  }
  const fixed = FIXED[id];
  if (fixed) return fixed;
  const m = /^([a-z_]+?)(\d+)$/.exec(id);
  const f = m && LADDER[m[1]!];
  return f ? f(Number(m[2])) : null;
}

export const recordTextEn = (id: string) => RECORD[id] ?? null;

/** 최초 기록 응답의 문구를 요청 언어로. 한국어면 그대로 돌려준다. */
export function localizeFirsts(data: FirstsResponse, lang: Lang): FirstsResponse {
  if (lang !== 'en') return data;
  return {
    ...data,
    items: data.items.map((i) => ({ ...i, label: firstLabelEn(i.id, data.season) ?? i.label })),
    records: data.records.map((r) => ({ ...r, ...(recordTextEn(r.id) ?? {}) })),
  };
}

/** 전광판 최초 기록·신기록 줄의 문구를 요청 언어로. */
export function localizeTickerFirsts<T extends TickerFirst>(
  items: readonly T[],
  season: number,
  lang: Lang,
): T[] {
  if (lang !== 'en') return [...items];
  return items.map((f) =>
    f.kind === 'first'
      ? { ...f, label: firstLabelEn(f.id, season) ?? f.label }
      : { ...f, ...(recordTextEn(f.id) ?? {}) },
  );
}
