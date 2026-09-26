// ───────── 실제 대회 구조: 국내 컵 · 슈퍼컵 · 대륙 클럽 대회 · 시상식 · 커리어 여정 ─────────
import { ovr } from './attributes.js';
import { clamp, ri, chance, gauss, rnd } from './rng.js';
import { leagueOf, clubsIn, roleOf, addStat, atkOf, creOf, rollScoring, START_P } from './engine.js';
import type { GameState, Season, SeasonComp } from './types.js';
import type { NatTourResult } from './national.js';

export const CUPS: Record<string, string[]> = {
  hs: ['전국고교축구선수권'], uni: ['전국대학축구선수권'], k3: ['코리아컵'], k2: ['코리아컵'], k1: ['코리아컵'], j1: ['일왕배', 'J리그컵'], mls: ['US 오픈컵', '리그스컵'],
  ere: ['KNVB컵'], l1: ['쿠프 드 프랑스'], bl: ['DFB-포칼'], sa: ['코파 이탈리아'], ll: ['코파 델 레이'], pl: ['FA컵', 'EFL컵'],
};
const SUPERCUP: Record<string, string> = { pl: 'FA 커뮤니티 실드', ll: '수페르코파 데 에스파냐', sa: '수페르코파 이탈리아나', bl: 'DFL 슈퍼컵', l1: '트로페 데 샹피옹', ere: '요한 크라위프 스할', j1: '재팬 슈퍼컵' };
export const TOP_SCORER: Record<string, string> = { pl: '프리미어리그 골든부트', ll: '피치치 트로피', sa: '카포칸노니에레', bl: '토르예거카논', l1: '리그 1 득점왕', ere: '에레디비시 득점왕', j1: 'J리그 득점왕', mls: 'MLS 골든부트', k1: 'K리그1 득점왕', k2: 'K리그2 득점왕', k3: 'K3리그 득점왕' };
export const POTY: Record<string, string> = { pl: 'PFA 올해의 선수', ll: '라리가 올해의 선수', sa: '세리에 A MVP', bl: '분데스리가 올해의 선수', l1: 'UNFP 올해의 선수', ere: '에레디비시 올해의 선수', j1: 'J리그 MVP', mls: 'MLS MVP', k1: 'K리그1 MVP', k2: 'K리그2 MVP', k3: 'K3리그 MVP' };
const YOUNG: Record<string, string> = { pl: 'PFA 올해의 영플레이어', k1: 'K리그1 영플레이어상', k2: 'K리그2 영플레이어상', j1: 'J리그 베스트 영플레이어상' };
/** ko: 리그 페이즈 없이 전 라운드 녹아웃(전반기 1라운드 · 후반기 16강~결승). */
export const CONT: Record<string, { name: string; avg: number; games: number; top: number; po: number | null; ko?: boolean }> = {
  UCL: { name: 'UEFA 챔피언스리그', avg: 80, games: 8, top: 16, po: 10 },
  UEL: { name: 'UEFA 유로파리그', avg: 74, games: 8, top: 16, po: 10 },
  UECL: { name: 'UEFA 컨퍼런스리그', avg: 69, games: 6, top: 12, po: 8 },
  ACLE: { name: 'AFC 챔피언스리그 엘리트', avg: 64, games: 8, top: 11, po: null },
  ACL2: { name: 'AFC 챔피언스리그 2', avg: 59, games: 6, top: 10, po: null },
  CCC: { name: 'CONCACAF 챔피언스컵', avg: 63, games: 0, top: 0, po: null, ko: true },
};
const BIG5: [string, number][] = [['UCL', 4], ['UEL', 2], ['UECL', 1]];
const CONT_SLOTS: Record<string, [string, number][]> = {
  pl: BIG5, ll: BIG5, bl: BIG5, sa: BIG5,
  l1: [['UCL', 3], ['UEL', 1], ['UECL', 1]], ere: [['UCL', 2], ['UEL', 1], ['UECL', 2]],
  k1: [['ACLE', 3], ['ACL2', 1]], j1: [['ACLE', 3], ['ACL2', 1]], mls: [['CCC', 6]],
};

// 첫 시즌 예상 순위: 리그 내 전력 순위를 6단계 표(1,3,5,8,11,14)에 비례해 옮긴다 — 클럽 수가 6이면
// 예전 고정표와 같다(T-10-009에서 리그별 팀 수가 늘어도 같은 범위를 유지).
const RANK_STEPS = [1, 3, 5, 8, 11, 14];
export function expectedRank(idx: number, n: number): number {
  const p = n > 1 ? (Math.max(0, idx) * (RANK_STEPS.length - 1)) / (n - 1) : 0;
  const lo = Math.floor(p);
  return Math.round(RANK_STEPS[lo]! + (RANK_STEPS[Math.min(lo + 1, RANK_STEPS.length - 1)]! - RANK_STEPS[lo]!) * (p - lo));
}

export function seasonSetup(s: GameState, S: Season) {
  const L = leagueOf(s.leagueId);
  S.trophiesMid = [];
  S.capsStart = s.nat ? s.nat.caps : 0;
  S.comps = (CUPS[L.id] ?? []).map((name) => ({ type: 'cup', name, alive: true, stage: '', apps: 0, g: 0, a: 0 }));
  if (L.amateur || s.club.id === 'sangmu') return;
  const last = s.career[s.career.length - 1];
  const same = last && last.club === s.club.name && last.league === L.name;
  const league = clubsIn(s.leagueId).sort((a, b) => b.str - a.str);
  const idx = league.findIndex((c) => c.id === s.club.id);
  const rank = same ? (last!.rank as number) : expectedRank(idx, league.length);
  let acc = 0;
  for (const [k, n] of CONT_SLOTS[L.id] ?? []) {
    if (rank <= acc + n) {
      S.comps.push({ type: 'cont', key: k, name: CONT[k]!.name, alive: true, stage: CONT[k]!.ko ? '1라운드' : '리그 페이즈', pts: 0, played: 0, apps: 0, g: 0, a: 0 });
      break;
    }
    acc += n;
  }
  if (SUPERCUP[L.id] && same && last!.honors.some((h) => h === `${L.name} 우승` || (CUPS[L.id] ?? []).some((c) => h === `${c} 우승`)))
    S.comps.push({ type: 'super', name: SUPERCUP[L.id]!, alive: true, stage: '', apps: 0, g: 0, a: 0 });
}

function compMatch(s: GameState, oppStr: number, startP: number) {
  const o = ovr(s);
  let mins = 0, g = 0, a = 0, perf = 0;
  if (s.injury === 0) {
    if (chance(startP)) mins = chance(0.2) ? ri(60, 85) : 90;
    else if (chance(0.35)) mins = ri(10, 30);
  }
  if (mins) {
    perf = (o - oppStr) / 10 + gauss() * 0.8 + (s.cond - 70) / 60;
    ({ g, a } = rollScoring(s, { atk: atkOf(s), cre: creOf(s), o }, perf, oppStr, mins));
  }
  return { mins, g, a, edge: (s.club.str - oppStr) * 0.03 + (mins ? perf * 0.03 + g * 0.1 : 0) };
}
function startChance(s: GameState, type: 'cup' | 'cont'): number {
  const r = roleOf(s);
  return (type === 'cup' ? { 주전: 0.6, 로테이션: 0.8, 벤치: 0.45 } : START_P)[r];
}
function tally(c: SeasonComp, m: { mins: number; g: number; a: number }) {
  if (m.mins) {
    c.apps++;
    c.g += m.g;
    c.a += m.a;
  }
}
function tie(s: GameState, c: SeasonComp, oppStr: number, legs: number): boolean {
  let edge = 0;
  for (let i = 0; i < legs; i++) {
    const m = compMatch(s, oppStr, startChance(s, c.type as 'cup' | 'cont'));
    tally(c, m);
    edge += m.edge;
  }
  return chance(clamp(0.5 + edge / legs, 0.08, 0.92));
}

const CUP_PLAN: Record<number, string[]> = { 1: ['32강', '16강'], 2: ['8강', '4강', '결승'] };
const CUP_OPP: Record<string, number> = { '32강': -6, '16강': -2, '8강': 1, '4강': 3, '결승': 5 };
export function compsPhase(s: GameState): { t: string; k: string }[] {
  const S = s.season, L = leagueOf(s.leagueId), lines: { t: string; k: string }[] = [];
  if (!S.comps) seasonSetup(s, S);
  for (const c of S.comps!) {
    if (!c.alive) continue;
    if (c.type === 'super' && s.phase === 0) {
      const won = tie(s, c, L.avg + 6, 1);
      c.alive = false;
      c.stage = won ? '우승' : '준우승';
      if (won) S.trophiesMid!.push(`${c.name} 우승`);
      lines.push({ t: `${c.name} ${won ? '우승!' : '준우승'}`, k: won ? 'good' : '' });
    } else if (c.type === 'cup' && CUP_PLAN[s.phase]) {
      for (const r of CUP_PLAN[s.phase]!) {
        const won = tie(s, c, L.avg + (CUP_OPP[r] ?? 0) + gauss() * 3, 1);
        if (!won) {
          c.alive = false;
          c.stage = r === '결승' ? '준우승' : `${r} 탈락`;
          break;
        }
        if (r === '결승') {
          c.alive = false;
          c.stage = '우승';
          S.trophiesMid!.push(`${c.name} 우승`);
        } else c.stage = `${r} 통과`;
      }
      lines.push({ t: `${c.name} ${c.stage === '우승' ? '우승!' : c.stage}`, k: c.stage === '우승' ? 'good' : c.alive ? '' : 'bad' });
    } else if (c.type === 'cont' && s.phase >= 1) contPhase(s, c, lines);
  }
  return lines;
}
function contPhase(s: GameState, c: SeasonComp, lines: { t: string; k: string }[]) {
  const C = CONT[c.key!]!, S = s.season;
  if (s.phase === 1 && C.ko) {
    if (tie(s, c, C.avg - 2 + gauss() * 2, 2)) {
      c.stage = '16강 진출';
      lines.push({ t: `${c.name} 1라운드 통과, 16강 진출`, k: 'good' });
    } else {
      c.alive = false;
      c.stage = '1라운드 탈락';
      lines.push({ t: `${c.name} 1라운드 탈락`, k: 'bad' });
    }
    return;
  }
  if (s.phase === 1) {
    for (let i = 0; i < C.games; i++) {
      const m = compMatch(s, C.avg + gauss() * 5, startChance(s, 'cont'));
      tally(c, m);
      const wp = clamp(0.4 + m.edge, 0.05, 0.9), x = rnd();
      c.pts = (c.pts ?? 0) + (x < wp ? 3 : x < wp + (1 - wp) * 0.35 ? 1 : 0);
      c.played = (c.played ?? 0) + 1;
    }
    if (c.pts! >= C.top) {
      c.stage = '16강 직행';
      lines.push({ t: `${c.name} 리그 페이즈 통과, 16강 직행 (승점 ${c.pts})`, k: 'good' });
    } else if (C.po && c.pts! >= C.po) {
      c.stage = '녹아웃 PO';
      lines.push({ t: `${c.name} 녹아웃 플레이오프 진출 (승점 ${c.pts})`, k: '' });
    } else {
      c.alive = false;
      c.stage = '리그 페이즈 탈락';
      lines.push({ t: `${c.name} 리그 페이즈 탈락 (승점 ${c.pts})`, k: 'bad' });
    }
    return;
  }
  const rounds = [...(c.stage === '녹아웃 PO' ? ['녹아웃 PO'] : []), '16강', '8강', '4강', '결승'];
  const asia = c.key!.startsWith('ACL');
  for (const r of rounds) {
    const opp = C.avg + ({ '녹아웃 PO': 0, '16강': 2, '8강': 5, '4강': 8, '결승': 10 } as Record<string, number>)[r]! + gauss() * 2;
    const won = tie(s, c, opp, r === '결승' || (asia && r !== '16강') ? 1 : 2);
    if (!won) {
      c.alive = false;
      c.stage = r === '결승' ? '준우승' : `${r} 탈락`;
      lines.push({ t: `${c.name} ${c.stage}`, k: r === '결승' ? '' : 'bad' });
      return;
    }
    if (r === '결승') {
      c.alive = false;
      c.stage = '우승';
      S.trophiesMid!.push(`${c.name} 우승`);
      lines.push({ t: `${c.name} 우승!!`, k: 'good' });
      return;
    }
    c.stage = r === '16강' ? '8강 진출' : `${r} 통과`;
  }
  lines.push({ t: `${c.name} ${c.stage}`, k: '' });
}
export function compGoals(S: Season) {
  return (S.comps ?? []).reduce((t, c) => ({ apps: t.apps + c.apps, g: t.g + c.g, a: t.a + c.a }), { apps: 0, g: 0, a: 0 });
}

// ───────── 시즌 개인상 · 발롱도르 시상식 ─────────
// T-10-042에서 한 시즌 득점·도움 상한이 낮아진 만큼 기준도 낮춰, 수상 빈도를 그 이전(T-10-039) 수준에 맞췄다.
const TOP_G = 0.57, TOP_A = 0.34, BALLON_BAR = 164.8, MULLER_BAR = 36, SHOE_BAR = 56.5;
export function seasonAwards(s: GameState, ctx: { rank: number; avg: number; trophies: string[]; tours: NatTourResult[] }) {
  const L = leagueOf(s.leagueId), S = s.season, m = L.matches, o = ovr(s);
  const { rank, avg, trophies, tours } = ctx, awards: string[] = [], gala: string[] = [];
  const cg = compGoals(S), allG = S.goals + cg.g, allA = S.assists + cg.a;
  const enough = S.apps >= m * 0.55, back = s.pos === 'DF' || s.pos === 'GK';
  const topG = m * TOP_G + gauss() * 3, topA = m * TOP_A + gauss() * 2;
  if (S.goals >= Math.max(topG, 6)) awards.push(L.amateur ? '득점왕' : TOP_SCORER[L.id]!);
  if (S.assists >= Math.max(topA, 5)) awards.push(L.amateur ? '도움왕' : `${L.name} 도움왕`);
  if (enough && avg >= 7.55 && (rank <= 3 || S.goals >= topG) && chance(0.5)) awards.push(L.amateur ? '대회 MVP' : POTY[L.id]!);
  if (enough && avg >= (back ? 7.2 : 7.3) && chance(0.75)) awards.push(L.amateur ? '대회 베스트 11' : L.tier >= 4 ? `${L.name} 올해의 팀` : `${L.name} 베스트 11`);
  if (!L.amateur && !s.flags.rookieDone) {
    s.flags.rookieDone = true;
    if (s.age <= 23 && S.apps >= m * 0.45 && avg >= 6.85) awards.push(YOUNG[L.id] ?? `${L.name} 올해의 영플레이어`);
  }
  if (L.amateur) return { awards, gala };

  const big = (t: string) => (trophies.includes(t) ? 1 : 0);
  const ntBonus = (tours ?? []).filter((t) => t.inSquad).reduce((b, t) => b + (({ 우승: 12, 금메달: 4, 준우승: 7, '4강': 5, '8강': 3 } as Record<string, number>)[t.stage] ?? 0) * (t.key === 'wc' ? 1 : 0.5), 0);
  const cont = (S.comps ?? []).find((c) => c.type === 'cont');
  const score = o + S.goals * 0.45 + S.assists * 0.28 + (cont ? cont.g * 0.7 + cont.a * 0.3 : 0) + avg * 5 + L.tier * 1.2 +
    big('UEFA 챔피언스리그 우승') * 12 + (rank === 1 ? 6 : 0) + ntBonus + (cont && cont.key === 'UCL' && /4강|결승|준우승/.test(cont.stage) ? 4 : 0) +
    (s.pos === 'GK' ? 3 : s.pos === 'DF' ? 2 : 0) + gauss() * 3;
  const ballonRank = clamp(Math.round(1 + (BALLON_BAR - score) / 0.8), 1, 99);
  if (L.tier >= 4 && ballonRank <= 30 && enough) {
    s.ballon = (s.ballon ?? []).concat({ year: s.year, rank: ballonRank });
    gala.push(ballonRank === 1 ? '발롱도르 수상!' : `발롱도르 ${ballonRank}위 (30인 후보)`);
    if (ballonRank === 1) awards.push('발롱도르');
    if (s.age <= 21) awards.push('코파 트로피');
    if (s.pos === 'GK' && ballonRank <= 25 && chance(0.6)) awards.push('야신 트로피');
    if (ballonRank <= 2 && chance(0.7)) awards.push('FIFA 더 베스트 남자 선수');
    if (ballonRank <= 12 && chance(0.8)) awards.push('FIFPRO 월드 11');
  }
  if (L.tier >= 4 && allG >= MULLER_BAR + gauss() * 3) awards.push('게르트 뮐러 트로피');
  const shoe = S.goals * (L.tier >= 5 ? 2 : 1.5);
  if (L.tier >= 4 && shoe >= SHOE_BAR + gauss() * 4) awards.push('유러피언 골든슈');
  if (s.pos === 'DF' && L.tier >= 5 && enough && avg >= 7.15 && rank <= 3 && chance(0.45)) awards.push(`${L.name} 올해의 수비수`);
  if (s.pos === 'GK' && enough && avg >= 7.1 && rank <= 4 && chance(0.45)) awards.push(`${L.name} 올해의 골키퍼`);
  const kfa = s.nat.caps > 0 && (ballonRank <= 30 || (o >= 80 && avg >= 7.2)) && chance(0.5);
  if (kfa) awards.push('대한축구협회 올해의 선수');
  // AFC 올해의 선수는 아시아 리그 소속, 국제선수상은 아시아 밖(유럽 · MLS)에서 뛰는 선수 몫이다.
  const outsideAsia = L.tier >= 4 || L.id === 'mls';
  if (outsideAsia && o >= 80 && enough && avg >= 7.1 && chance(0.35)) awards.push('AFC 올해의 국제선수');
  if (!outsideAsia && o >= 72 && enough && avg >= 7.3 && chance(0.25)) awards.push('AFC 올해의 선수');
  return { awards, gala, allG, allA };
}

// ───────── 커리어 여정 (마일스톤) ─────────
export const SANGMU_NAME = '김천 상무 (국군체육부대)';
function mile(s: GameState, key: string, text: string, fame = 1): string | null {
  s.miles = s.miles ?? [];
  if (s.flags['m_' + key]) return null;
  s.flags['m_' + key] = 1;
  s.miles.push({ year: s.year, t: text });
  addStat(s, 'fame', fame);
  return text;
}
export function checkMilestones(s: GameState, rec: { pro?: boolean; apps: number; goals: number; club: string }): string[] {
  const out: string[] = [];
  const add = (k: string, t: string, f?: number) => {
    const r = mile(s, k, t, f);
    if (r) out.push(r);
  };
  const pro = s.career.filter((r) => r.pro);
  const T = pro.reduce((a, r) => ({ p: a.p + r.apps, g: a.g + r.goals }), { p: 0, g: 0 });
  const L = leagueOf(s.leagueId);
  if (rec.pro && rec.apps) add('debut', `프로 데뷔 (${rec.club})`);
  if (rec.pro && rec.goals) add('debutGoal', `프로 데뷔골`);
  for (const n of [100, 200, 300, 400, 500, 600]) if (T.p >= n) add('apps' + n, `프로 통산 ${n}경기 출전`, n / 100);
  for (const n of [50, 100, 150, 200, 300]) if (T.g >= n) add('goals' + n, `프로 통산 ${n}골`, n / 50);
  if (L.tier >= 4) add('europe', `유럽 무대 진출 (${L.name})`, 2);
  if (L.tier >= 5) add('big5', `유럽 5대 리그 입성 (${L.name})`, 2);
  if (L.id === 'mls') add('mls', `미국 무대 진출 (${L.name})`, 2);
  const cont = (s.season.comps ?? []).find((c) => c.type === 'cont');
  if (cont && cont.apps) add('cont_' + cont.key, `${cont.name} 데뷔`, 3);
  if (cont && cont.g) add('contG_' + cont.key, `${cont.name} 데뷔골`, 3);
  if (cont && cont.key === 'UCL' && /결승|우승|준우승/.test(cont.stage) && cont.apps) add('uclFinal', '챔피언스리그 결승 무대', 2);
  if (s.nat.caps) add('ntDebut', 'A매치 데뷔', 2);
  if (s.nat.goals) add('ntGoal', 'A매치 데뷔골', 2);
  for (const n of [50, 100]) if (s.nat.caps >= n) add('caps' + n, n === 100 ? '센추리 클럽 가입 (A매치 100경기)' : `A매치 ${n}경기 출전`, n / 20);
  if (s.nat.captain) add('captain', '국가대표팀 주장 선임', 3);
  for (const t of s.nat.tours) {
    if (t.inSquad && t.name.includes('월드컵') && t.apps) add('wc', '월드컵 본선 출전', 3);
    if (t.inSquad && t.name.includes('월드컵') && t.goals) add('wcGoal', '월드컵 본선 득점', 3);
  }
  if ((s.ballon ?? []).length) add('ballonNom', '발롱도르 30인 후보 선정', 3);
  if (pro.length >= 5 && new Set(pro.map((r) => r.club)).size === 1) add('loyal5', `${rec.club} 한 팀에서 5시즌`, 2);
  return out;
}
export function retireMilestones(s: GameState): string[] {
  const pro = s.career.filter((r) => r.pro && !r.mil && r.club !== SANGMU_NAME);
  const clubs = new Set(pro.map((r) => r.club));
  const out: (string | null)[] = [];
  if (pro.length >= 8 && clubs.size === 1) out.push(mile(s, 'oneclub', `원클럽맨 · ${s.club.name} 영구결번 (No.${s.number})`, 0));
  else {
    const byClub: Record<string, number> = {};
    pro.forEach((r) => (byClub[r.club] = (byClub[r.club] ?? 0) + r.goals + r.apps * 0.2));
    const best = Object.entries(byClub).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 80) out.push(mile(s, 'legendClub', `${best[0]} 레전드 헌정`, 0));
  }
  if (s.nat.caps >= 30) out.push(mile(s, 'ntFarewell', 'A대표팀 은퇴 경기', 0));
  out.push(mile(s, 'farewell', `${s.club.name} 홈구장에서 은퇴 경기`, 0));
  return out.filter((x): x is string => !!x);
}
