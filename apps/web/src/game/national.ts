// ───────── 대한민국 국가대표 · 국제대회 ─────────
import { POS, LAST_PHASE } from './data.js';
import { ovr } from './attributes.js';
import { clamp, ri, pick, chance, gauss, poisson, rnd } from './rng.js';
import { EVENTS } from './events-data.js';
import { leagueOf, addStat, log } from './engine.js';
import type { GameState, NatTour } from './types.js';

const KOREA_STR = 75, KOREA_U23 = 69, NT_THRESHOLD = 80;
const AFC_NT: [string, number][] = [
  ['일본', 77], ['이란', 74], ['호주', 73], ['사우디아라비아', 69], ['우즈베키스탄', 68], ['카타르', 68], ['이라크', 67],
  ['요르단', 67], ['UAE', 66], ['오만', 64], ['바레인', 63], ['중국', 62], ['태국', 61], ['베트남', 60], ['팔레스타인', 60], ['쿠웨이트', 58], ['키르기스스탄', 58],
];
const WORLD_NT: [string, number][] = [
  ['아르헨티나', 88], ['프랑스', 88], ['스페인', 88], ['잉글랜드', 86], ['브라질', 86], ['포르투갈', 85], ['네덜란드', 84], ['독일', 84],
  ['벨기에', 82], ['이탈리아', 82], ['크로아티아', 81], ['모로코', 81], ['우루과이', 80], ['콜롬비아', 80], ['덴마크', 80], ['스위스', 79],
  ['멕시코', 78], ['미국', 78], ['세네갈', 78], ['오스트리아', 78], ['노르웨이', 78], ['에콰도르', 77], ['튀르키예', 77], ['파라과이', 76],
  ['캐나다', 75], ['코트디부아르', 74], ['가나', 72], ['튀니지', 72], ['카메룬', 72], ['코스타리카', 70],
];
export const HOSTS = {
  wc: { 2026: '미국·캐나다·멕시코', 2030: '스페인·포르투갈·모로코', 2034: '사우디아라비아' } as Record<number, string>,
  asian: { 2027: '사우디아라비아' } as Record<number, string>,
  ag: { 2026: '일본 아이치·나고야', 2030: '카타르 도하', 2034: '사우디아라비아 리야드' } as Record<number, string>,
  olympic: { 2028: '미국 LA', 2032: '호주 브리즈번' } as Record<number, string>,
};
const WINDOW_NAME: string[][] = [[], ['9월 A매치', '10월 A매치'], ['11월 A매치', '3월 A매치']];

// 기존 단순 '국가대표 발탁' 이벤트는 실제 소집 시스템으로 대체
{
  const i = EVENTS.findIndex((e) => e.id === 'national');
  if (i >= 0) EVENTS.splice(i, 1);
}

export function natInit(s: GameState) {
  s.nat = Object.assign({ caps: 0, goals: 0, assists: 0, tours: [], qual: { 2026: true }, captain: false, debutYear: null }, s.nat || {});
  s.mil = s.mil || { exempt: null, served: false, serving: false, left: 0, type: null, prevClub: null };
}
const isQualYear = (y: number) => y % 4 === 0 || y % 4 === 1;
export const nextWC = (y: number) => y + (((2 - (y % 4) + 4) % 4) || 4);
const u23 = (t: [string, number]): [string, number] => [`${t[0]} U-23`, t[1] - 6];

export function callupScore(s: GameState): number {
  const S = s.season, form = S.apps ? S.ratingSum / S.apps : 6.6;
  return ovr(s) + (form - 6.8) * 4 + leagueOf(s.leagueId).tier * 0.6 + s.fame * 0.02 - (s.age >= 33 ? (s.age - 32) * 2 : 0);
}

export interface IntlResult {
  comp: string; stage: string; opp: string; kg: number; og: number; res: string; pso: string | null; mins: number; g: number; a: number; rating: number | null;
}
function simIntl(s: GameState, opp: [string, number], role: 'starter' | 'sub' | 'none', teamStr: number, comp: string, stage = ''): IntlResult {
  const P = POS[s.pos], o = ovr(s);
  let mins = 0;
  if (role === 'starter') mins = chance(0.82) ? 90 : ri(60, 85);
  else if (role === 'sub') mins = chance(0.6) ? ri(10, 35) : 0;
  const diff = teamStr + (mins ? (o - teamStr) * 0.12 * (mins / 90) : 0) - opp[1];
  const kg = poisson(clamp(1.3 + diff * 0.04, 0.25, 3.2)), og = poisson(clamp(1.1 - diff * 0.04, 0.2, 3.2));
  let g = 0, a = 0;
  if (mins) {
    const atk = Object.entries(P.atk).reduce((t, [k, w]) => t + s.attrs[k as keyof typeof s.attrs] * (w as number), 0);
    const cre = s.attrs.pas * 0.7 + s.attrs.dri * 0.3;
    g = Math.min(kg, poisson(P.goal * Math.exp((atk - opp[1]) / 20) * (mins / 90)));
    a = Math.min(kg - g, poisson(P.assist * Math.exp((cre - opp[1]) / 20) * (mins / 90)));
  }
  let res = kg > og ? 'W' : kg < og ? 'L' : 'D';
  let pso: string | null = null;
  if (res === 'D' && stage) {
    const win = chance(0.5 + (s.pos === 'GK' && mins ? (s.attrs.def - 70) * 0.012 : 0));
    const w = ri(3, 5), l = w - ri(1, 2);
    pso = win ? `${w}-${l}` : `${l}-${w}`;
    res = win ? 'PW' : 'PL';
  }
  const win = res === 'W' || res === 'PW';
  const rating = mins ? clamp(Math.round((6.3 + g * 0.9 + a * 0.5 + (o - teamStr) * 0.03 + (win ? 0.25 : res === 'D' ? 0 : -0.25) + gauss() * 0.3) * 10) / 10, 4.5, 10) : null;
  if (mins) {
    s.nat.caps++;
    s.nat.goals += g;
    s.nat.assists += a;
  }
  if (opp[0].startsWith('일본') && win && mins) {
    addStat(s, 'fame', 3);
    log(s, `한일전 승리!${g ? ` ${g}골을 터뜨리며` : ''} 국민 영웅이 됐습니다.`, 'good');
  }
  return { comp, stage, opp: opp[0], kg, og, res, pso, mins, g, a, rating };
}
export function scoreLine(m: IntlResult): string {
  return `대한민국 ${m.kg}-${m.og} ${m.opp}${m.pso ? ` (승부차기 ${m.pso})` : ''}`;
}

export function natWindow(s: GameState) {
  natInit(s);
  if (leagueOf(s.leagueId).amateur || s.phase < 1 || s.phase > LAST_PHASE) return null;
  const names = WINDOW_NAME[s.phase] ?? [];
  const out = names.map((name) => natOne(s, name)).filter(Boolean);
  return out.length ? out : null;
}
function natOne(s: GameState, name: string) {
  const sc = callupScore(s), thr = NT_THRESHOLD + gauss() * 1.2;
  if (s.injury > 0 || sc < thr) return s.nat.caps && sc >= thr - 4 ? { name, called: false } : null;
  const qual = isQualYear(s.year);
  const comp = qual ? `${nextWC(s.year)} 월드컵 아시아 예선` : '친선 A매치';
  const role: 'starter' | 'sub' = sc >= 85 || s.nat.captain ? 'starter' : chance(0.45) ? 'starter' : 'sub';
  const pool = qual ? AFC_NT.slice(0, 14) : chance(0.55) ? WORLD_NT : AFC_NT.slice(0, 8);
  const o1 = pick(pool);
  let o2: [string, number];
  do o2 = pick(pool); while (o2 === o1);
  if (!s.nat.debutYear) {
    s.nat.debutYear = s.year;
    addStat(s, 'fame', 5);
    log(s, `생애 첫 A대표팀 발탁! (${name})`, 'big');
  }
  const games = [o1, o2].map((o) => simIntl(s, o, role, KOREA_STR, comp));
  addStat(s, 'cond', -6);
  games.forEach((m) => log(s, `[${comp}] ${scoreLine(m)}${m.mins ? ` · ${m.mins}분${m.g ? ` ${m.g}골` : ''}${m.a ? ` ${m.a}도움` : ''}` : ' · 벤치'}`));
  return { name, comp, called: true, role, games };
}

interface TournamentDef {
  label: (y: number) => string; team: number; youth: boolean;
  group: () => [string, number][]; adv: (pts: number) => boolean;
  rounds: [string, [string, number][]][]; trophy: string; bronze?: [string, number][]; exempt?: (stage: string) => boolean;
}
function pickDistinct<T>(pool: T[], n: number): T[] {
  const p = pool.slice(), out: T[] = [];
  while (out.length < n && p.length) out.push(p.splice(Math.floor(rnd() * p.length), 1)[0]!);
  return out;
}
const TOURNAMENTS: Record<string, TournamentDef> = {
  wc: {
    label: (y) => `${y} FIFA 월드컵 (${HOSTS.wc[y] ?? '개최지 미정'})`, team: KOREA_STR, youth: false,
    group: () => [pick(WORLD_NT.slice(0, 10)), pick(WORLD_NT.slice(10, 22)), pick(WORLD_NT.slice(22).concat(AFC_NT.slice(3, 8)))],
    adv: (pts) => pts >= 6 || (pts >= 4 && chance(0.9)) || (pts === 3 && chance(0.45)),
    rounds: [['32강', WORLD_NT.slice(8, 30)], ['16강', WORLD_NT.slice(4, 22)], ['8강', WORLD_NT.slice(0, 14)], ['4강', WORLD_NT.slice(0, 9)], ['결승', WORLD_NT.slice(0, 6)]],
    trophy: 'FIFA 월드컵 우승',
  },
  asian: {
    label: (y) => `${y} AFC 아시안컵${HOSTS.asian[y] ? ` (${HOSTS.asian[y]})` : ''}`, team: KOREA_STR, youth: false,
    group: () => pickDistinct(AFC_NT.slice(4), 3),
    adv: (pts) => pts >= 4 || (pts === 3 && chance(0.6)),
    rounds: [['16강', AFC_NT.slice(3, 12)], ['8강', AFC_NT.slice(1, 9)], ['4강', AFC_NT.slice(0, 6)], ['결승', AFC_NT.slice(0, 3)]],
    trophy: 'AFC 아시안컵 우승',
  },
  ag: {
    label: (y) => `${y} 아시안게임 (${HOSTS.ag[y] ?? '개최지 미정'})`, team: KOREA_U23, youth: true,
    group: () => pickDistinct(AFC_NT.slice(8), 3).map(u23),
    adv: (pts) => pts >= 4 || (pts === 3 && chance(0.6)),
    rounds: [['16강', AFC_NT.slice(4, 14).map(u23)], ['8강', AFC_NT.slice(2, 10).map(u23)], ['4강', AFC_NT.slice(0, 6).map(u23)], ['결승', AFC_NT.slice(0, 3).map(u23)]],
    trophy: '아시안게임 금메달', exempt: (stage) => stage === '우승',
  },
  olympic: {
    label: (y) => `${y} 올림픽 남자축구 (${HOSTS.olympic[y] ?? '개최지 미정'})`, team: KOREA_U23, youth: true,
    group: () => [pick(WORLD_NT.slice(0, 10)), pick(WORLD_NT.slice(10, 24)), pick(AFC_NT.slice(0, 6).concat(WORLD_NT.slice(24)))].map(u23),
    adv: (pts) => pts >= 6 || (pts >= 4 && chance(0.7)) || (pts === 3 && chance(0.2)),
    rounds: [['8강', WORLD_NT.slice(0, 20).map(u23)], ['4강', WORLD_NT.slice(0, 10).map(u23)], ['결승', WORLD_NT.slice(0, 6).map(u23)]],
    bronze: WORLD_NT.slice(0, 14).map(u23), trophy: '올림픽 금메달', exempt: (stage) => ['금메달', '은메달', '동메달'].includes(stage),
  },
};

/** 차출 협상이 필요한 대회: 협상 결과 플래그 접두어와, 협상 이벤트 없이 해외 구단이 허락할 확률. */
export const RELEASE: Record<string, { flag: string; p: number }> = { ag: { flag: 'agRel', p: 0.6 }, olympic: { flag: 'olyRel', p: 0.7 } };
/** 올림픽 아시아 예선(AFC U-23 아시안컵) 통과 확률 — 한국은 1988~2020 10회 연속 진출, 2024 파리 예선 탈락. */
const OLY_QUAL = 0.85;

function squadRole(s: GameState, key: string): { role: 'starter' | 'sub' | 'none'; why: string } {
  const T = TOURNAMENTS[key]!, sc = callupScore(s);
  if (leagueOf(s.leagueId).amateur && !T.youth) return { role: 'none', why: '' };
  if (s.injury > 0) return { role: 'none', why: '부상으로 최종 명단 제외' };
  if (T.youth) {
    const young = s.age <= 23;
    const need = young ? 68 : 84;
    if (sc < need + gauss() * 1.5) return { role: 'none', why: young ? '최종 명단 탈락' : '' };
    // 아시안게임·올림픽 남자축구는 FIFA 의무 차출 대회가 아니라 해외 구단은 거절할 수 있다(T-10-016 올림픽 추가).
    // 올림픽은 7~8월이라 유럽 프리시즌과 겹쳐 시즌 중인 아시안게임(9월)보다 조금 더 잘 보내 준다.
    const release = RELEASE[key];
    if (release) {
      const rel = s.flags[release.flag + s.year] as boolean | undefined;
      const ok = rel !== undefined ? rel : leagueOf(s.leagueId).tier <= 2 || chance(release.p);
      if (!ok) return { role: 'none', why: '소속팀이 차출을 거부' };
    }
    return { role: sc >= need + 6 || !young ? 'starter' : chance(0.5) ? 'starter' : 'sub', why: young ? '' : '와일드카드 발탁' };
  }
  if (sc < NT_THRESHOLD - 1 + gauss() * 1.2) return { role: 'none', why: s.nat.caps ? '최종 명단 탈락' : '' };
  return { role: sc >= 85 || s.nat.captain ? 'starter' : chance(0.5) ? 'starter' : 'sub', why: '' };
}

function runTournament(s: GameState, key: string) {
  const T = TOURNAMENTS[key]!, y = s.year;
  const { role, why } = squadRole(s, key);
  const matches: IntlResult[] = [];
  const play = (opp: [string, number], stage: string) => {
    const m = simIntl(s, opp, role, T.team, T.label(y), stage);
    matches.push(m);
    return m;
  };
  let pts = 0;
  for (const opp of T.group()) {
    const m = play(opp, '');
    pts += m.res === 'W' ? 3 : m.res === 'D' ? 1 : 0;
  }
  let stage = '조별리그 탈락';
  if (T.adv(pts)) {
    for (let i = 0; i < T.rounds.length; i++) {
      const [name, pool] = T.rounds[i]!;
      stage = name;
      const m = play(pick(pool), name);
      const won = m.res === 'W' || m.res === 'PW';
      if (name === '결승') {
        stage = won ? '우승' : '준우승';
        break;
      }
      if (!won) {
        if (key === 'olympic' && name === '4강') {
          const b = play(pick(T.bronze!), '동메달 결정전');
          stage = b.res === 'W' || b.res === 'PW' ? '동메달' : '4위';
        }
        break;
      }
    }
  }
  if (key === 'olympic') stage = stage === '우승' ? '금메달' : stage === '준우승' ? '은메달' : stage;
  const inSquad = role !== 'none';
  const mine = matches.filter((m) => m.mins);
  const rec: NatTour = { year: y, key, name: T.label(y), stage, inSquad, why, apps: mine.length, goals: mine.reduce((t, m) => t + m.g, 0), matches } as NatTour;
  s.nat.tours.push({ year: y, name: rec.name, stage, inSquad, apps: rec.apps, goals: rec.goals });
  const trophy = inSquad && (stage === '우승' || stage === '금메달') ? T.trophy : inSquad && key === 'olympic' && ['은메달', '동메달'].includes(stage) ? `올림픽 ${stage}` : null;
  if (inSquad) addStat(s, 'fame', ({ '조별리그 탈락': 1, '32강': 3, '16강': 4, '8강': 7, '4강': 10, '동메달': 10, '4위': 8, '준우승': 12, '은메달': 12, '우승': 18, '금메달': 18 } as Record<string, number>)[stage] ?? 2);
  if (inSquad && T.exempt && T.exempt(stage) && !s.mil.exempt && !s.mil.served) {
    s.mil.exempt = key === 'ag' ? '아시안게임 금메달' : `올림픽 ${stage}`;
    log(s, `병역 특례 대상! (${s.mil.exempt}) 기초군사훈련 3주와 544시간 봉사활동으로 병역을 대신합니다.${s.mil.serving ? ' 복무 중이던 김천 상무에서는 시즌 종료 후 조기 전역합니다.' : ''}`, 'big');
    s.mil.applied = false; s.mil.accepted = false; s.mil.armyNext = false;
  }
  return { rec, trophy };
}

export function natSeasonEnd(s: GameState) {
  natInit(s);
  const y = s.year, out: NatTour[] = [], trophies: string[] = [];
  const keys: string[] = [];
  if (y % 4 === 2 && s.nat.qual[y] !== false) keys.push('wc');
  if (y % 4 === 2) keys.push('ag');
  if (y % 4 === 3) keys.push('asian');
  if (y % 4 === 0 && s.nat.qual[y] !== false) keys.push('olympic');
  if (y % 4 === 2 && s.nat.qual[y] === false) out.push({ year: y, name: `${y} FIFA 월드컵`, stage: '본선 진출 실패', inSquad: false, apps: 0, goals: 0, matches: [] });
  if (y % 4 === 0 && s.nat.qual[y] === false) out.push({ year: y, name: `${y} 올림픽 남자축구`, stage: '본선 진출 실패', inSquad: false, apps: 0, goals: 0, matches: [] });
  for (const k of keys) {
    const { rec, trophy } = runTournament(s, k);
    out.push(rec);
    if (trophy) trophies.push(trophy);
  }
  if (y % 4 === 1) {
    const ok = chance(0.9);
    s.nat.qual[y + 1] = ok;
    out.push({ year: y, name: `${y + 1} 월드컵 아시아 예선`, stage: ok ? '본선 진출 확정' : '본선 진출 실패', inSquad: false, apps: 0, goals: 0, matches: [] });
  }
  if (y % 4 === 3) {
    const ok = chance(OLY_QUAL);
    s.nat.qual[y + 1] = ok;
    out.push({ year: y, name: `${y + 1} 올림픽 아시아 예선 (AFC U-23 아시안컵)`, stage: ok ? '본선 진출 확정' : '본선 진출 실패', inSquad: false, apps: 0, goals: 0, matches: [] });
  }
  if (!s.nat.captain && s.nat.caps >= 40 && ovr(s) >= 78 && chance(0.35)) {
    s.nat.captain = true;
    log(s, '국가대표팀 주장으로 선임됐습니다.', 'big');
    addStat(s, 'fame', 6);
  }
  return { tours: out, trophies };
}
