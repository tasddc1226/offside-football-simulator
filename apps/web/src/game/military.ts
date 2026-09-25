// ───────── 병역: 국군체육부대(김천 상무) · 현역 입대 · 체육요원 특례 ─────────
import { clamp, ri, chance } from './rng.js';
import { EVENTS } from './events-data.js';
import { leagueOf, log, salaryFor, schedule, addAttr, addStat, newSeason } from './engine.js';
import { ovr as ovrCalc } from './attributes.js';
import type { GameState, MarketOption, MilOption } from './types.js';

export const SANGMU = { id: 'sangmu', name: '김천 상무 (국군체육부대)', leagueId: 'k1', str: 63 };
const MIL_AGE = 28;
const SANGMU_MIN_AGE = 22;

export function milDone(s: GameState): boolean {
  return !!(s.mil.exempt || s.mil.served);
}
export function milAbroad(s: GameState): boolean {
  return leagueOf(s.leagueId).tier >= 3;
}
export function sangmuChance(s: GameState): number {
  const L = leagueOf(s.leagueId);
  let p = 0.28 + (ovrCalc(s) - 63) * 0.035 + (s.fame - 30) * 0.002;
  if (L.id === 'k1' || L.id === 'k2') p += 0.1;
  else if (L.tier >= 3) p -= 0.15;
  else p -= 0.1;
  if (s.age >= MIL_AGE) p -= 0.12;
  return clamp(p, 0.08, 0.8);
}
export function milDue(s: GameState): boolean {
  return !milDone(s) && !s.mil.serving && !leagueOf(s.leagueId).amateur && s.age >= MIL_AGE;
}
export function milCanApply(s: GameState): boolean {
  return (
    !milDone(s) && !s.mil.serving && !s.mil.applied && !s.mil.accepted && !s.mil.armyNext && !leagueOf(s.leagueId).amateur &&
    s.age >= SANGMU_MIN_AGE && s.age < MIL_AGE
  );
}
export function milStatusText(s: GameState): string {
  const m = s.mil;
  if (m.exempt) return `병역 특례 (${m.exempt})`;
  if (m.serving) return `상무 복무 중 · 전역까지 ${m.left}시즌`;
  if (m.served) return m.type === 'army' ? '현역 만기 전역' : '상무 만기 전역';
  if (m.accepted) return '상무 최종 합격 · 입대 대기';
  if (m.armyNext) return '현역 입대 예정 (시즌 종료 후)';
  if (m.applied) return '상무 지원 · 시즌 종료 후 발표';
  return leagueOf(s.leagueId).amateur ? '미필' : `미필 · 만 ${MIL_AGE}세까지 이행 필요`;
}

export function milOptions(s: GameState): MilOption[] {
  if (milDone(s) || s.mil.serving || leagueOf(s.leagueId).amateur || s.age < SANGMU_MIN_AGE) return [];
  const due = s.age >= MIL_AGE, abroad = milAbroad(s);
  const out: MilOption[] = [];
  if (due || !s.flags['sangmuTry' + s.year]) {
    const p = Math.round(sangmuChance(s) * 100);
    out.push({
      kind: 'sangmu', name: due ? '국군체육부대(상무) 마지막 지원' : '국군체육부대(상무) 추가 모집 지원', due,
      desc: `합격 확률 ${p}% · 김천 상무에서 2시즌 복무하며 K리그1 출전${abroad ? ' · 해외 구단과의 계약은 해지됩니다' : ' · 전역 후 원소속팀 복귀'}${due ? ' · 불합격 시 현역 입대' : ' · 불합격 시 현 소속팀 잔류'}`,
    });
  }
  if (due || s.age >= 25) out.push({ kind: 'army', name: due ? '현역 입대' : '현역 입대 (조기 이행)', desc: `18개월 복무 · 2시즌 동안 공식 경기 출전 불가${abroad ? ' · 해외 구단과의 계약 해지' : ''}, 전역 후 원소속팀 복귀 협상` });
  return out;
}

export function enlistSangmu(s: GameState) {
  const abroad = milAbroad(s);
  s.mil.prevClub = { club: { ...s.club }, leagueId: s.leagueId, contract: s.contract && !abroad ? { ...s.contract } : null, abroad };
  s.mil.serving = true; s.mil.type = 'sangmu'; s.mil.left = 2; s.mil.accepted = false;
  if (abroad) s.fame = Math.round(s.fame * 0.9);
  s.leagueId = SANGMU.leagueId; s.club = { ...SANGMU }; s.trust = 1;
  s.contract = { years: 2, salary: 2400 };
  log(s, abroad ? `국군체육부대 입대. ${s.mil.prevClub.club.name}과(와)의 계약을 해지하고 귀국해 김천 상무 유니폼을 입습니다. (복무 2시즌)`
    : '국군체육부대 최종 합격! 김천 상무 유니폼을 입습니다. (복무 2시즌)', 'big');
}
export function serveArmy(s: GameState) {
  const L = leagueOf(s.leagueId), abroad = L.tier >= 3;
  const f = s.age <= 24 ? 0.5 : 1;
  for (let i = 0; i < 2; i++) {
    s.career.push({ year: s.year, age: s.age, club: '현역 복무', league: '병역', apps: 0, goals: 0, assists: 0, cs: 0, rating: 0, rank: '-', ovr: ovrCalc(s), honors: [], mil: true });
    s.age++; s.year++;
  }
  addAttr(s, 'pac', -ri(3, 5) * f);
  addAttr(s, 'phy', -ri(1, 4) * f);
  for (const k of ['sho', 'pas', 'dri', 'def'] as const) addAttr(s, k, -ri(1, 3) * f);
  s.fame = Math.round(s.fame * 0.65);
  s.mil.served = true; s.mil.type = 'army'; s.mil.applied = false; s.mil.accepted = false; s.mil.armyNext = false;
  if (s.contract) s.contract.years = 0;
  s.cond = 80; s.morale = 60;
  log(s, `18개월의 현역 복무를 마치고 만기 전역했습니다. 몸을 다시 만들어야 합니다. (${abroad ? `${s.club.name}과(와)의 계약은 입대 때 해지됨 · 새 팀을 찾아야 합니다` : `${L.name} 복귀 도전`})`, 'big');
}
export function milSeasonEnd(s: GameState): string | null {
  if (s.mil.applied) {
    s.mil.applied = false;
    s.flags['sangmuTry' + (s.year + 1)] = 1;
    if (milDone(s)) return '병역 특례로 상무 지원 취소';
    if (chance(sangmuChance(s))) {
      s.mil.accepted = true;
      log(s, '국군체육부대 최종 합격! 다음 시즌 김천 상무에 입대합니다.', 'big');
      return '상무 최종 합격 · 다음 시즌 입대';
    }
    log(s, '국군체육부대 불합격. 다음 모집에 다시 도전할 수 있습니다.', 'bad');
    return '상무 불합격';
  }
  if (!s.mil.serving || s.mil.type !== 'sangmu') {
    if (!milDone(s) && !s.mil.serving && !s.mil.accepted && !s.mil.armyNext) {
      schedule(s, 'mil-notice', 2, 1);
      schedule(s, 'mil-notice-low', 2, 1);
    }
    return null;
  }
  s.mil.left--;
  const early = !!s.mil.exempt;
  if (s.mil.left > 0 && !early) return '상무 복무 1시즌 남음';
  const prev = s.mil.prevClub!;
  s.mil.serving = false; s.mil.served = true; s.mil.left = 0;
  s.club = { ...prev.club }; s.leagueId = prev.leagueId; s.trust = 0;
  s.contract = prev.contract ? { ...prev.contract, years: prev.contract.years + 1 } : { years: 0, salary: salaryFor(prev.leagueId, ovrCalc(s)) };
  const how = early ? '병역 특례로 조기 전역' : '김천 상무에서 만기 전역';
  log(s, prev.abroad ? `${how}! 계약이 해지됐던 ${s.club.name}와(과) 복귀 협상에 나섭니다.` : `${how}! 원소속팀 ${s.club.name}(으)로 돌아갑니다.`, 'big');
  return `${early ? '조기 전역' : '상무 만기 전역'} → ${s.club.name} ${prev.abroad ? '복귀 협상' : '복귀'}`;
}

export interface MarketResult {
  options: MarketOption[];
  note: string;
  canRetire: boolean;
}
export function milEnlistMarket(s: GameState): MarketResult | null {
  if (s.mil.armyNext) {
    s.mil.armyNext = false;
    if (!milDone(s)) return { options: [{ kind: 'army', name: '현역 입대', desc: `18개월 복무 · 2시즌 동안 공식 경기 출전 불가${milAbroad(s) ? ' · 해외 구단과의 계약 해지' : ''}, 전역 후 원소속팀 복귀 협상` }], note: '입영 통지서가 도착했습니다. 약속대로 현역으로 입대합니다.', canRetire: false };
  }
  if (!s.mil.accepted || milDone(s)) {
    s.mil.accepted = false;
    return null;
  }
  const from = s.club.name, abroad = milAbroad(s);
  enlistSangmu(s);
  return {
    options: [{ kind: 'serve', first: true, name: '김천 상무 입대', desc: `복무 2시즌 · K리그1 출전${abroad ? ` · ${from}과(와)의 계약 해지` : ` · 전역 후 ${from} 복귀`}` }],
    note: '국군체육부대 최종 합격자 명단에 이름이 올랐습니다.', canRetire: false,
  };
}

export function acceptMilitary(s: GameState, opt: MilOption): { text: string; ok?: boolean; reopen?: boolean } | null {
  if (opt.kind === 'serve') {
    s.season = newSeason(s);
    s.phase = 0;
    return { text: opt.first ? '김천 상무에 입대했습니다. 2시즌 동안 K리그1 무대에서 뛰며 병역을 이행합니다.' : `김천 상무 복무를 이어갑니다. (전역까지 ${s.mil.left}시즌)`, ok: true };
  }
  if (opt.kind === 'sangmu') {
    s.flags['sangmuTry' + s.year] = 1;
    if (chance(sangmuChance(s))) {
      enlistSangmu(s);
      s.season = newSeason(s);
      s.phase = 0;
      return { text: '국군체육부대 최종 합격! 김천 상무에서 2시즌 동안 뛰며 병역을 이행합니다.', ok: true };
    }
    if (opt.due) {
      serveArmy(s);
      return { text: '상무 불합격… 만 28세 입영 기한에 걸려 현역으로 입대했습니다. 18개월 뒤 다시 그라운드를 밟습니다.', reopen: true };
    }
    log(s, '국군체육부대 불합격. 다음 모집에 다시 도전할 수 있습니다.', 'bad');
    if (!s.contract || s.contract.years <= 0) return { text: '상무 불합격. 다음 모집에 다시 도전할 수 있습니다. 먼저 뛸 팀을 정하세요.', reopen: true };
    s.season = newSeason(s);
    s.phase = 0;
    return { text: '상무 불합격. 현 소속팀에서 한 시즌 더 뛰며 다시 도전합니다.', ok: false };
  }
  if (opt.kind === 'army') {
    serveArmy(s);
    return { text: '현역으로 입대했습니다. 18개월 뒤 전역해 복귀를 준비합니다.', reopen: true };
  }
  return null;
}

// ───────── 시즌 중 상무 모집 공고 ─────────
function milExemptHope(s: GameState): string[] {
  const out: string[] = [];
  for (let y = s.year; y <= s.year + 2; y++) {
    const age = s.age + (y - s.year);
    if (age > 23) break;
    if (y % 4 === 2) out.push(`${y} 아시안게임`);
    if (y % 4 === 0 && s.nat?.qual[y] !== false) out.push(`${y} 올림픽`);
  }
  return out;
}
const MIL_LOW = 0.35;
const milNoticeText = (s: GameState): string => {
  const left = MIL_AGE - s.age, hope = milExemptHope(s), abroad = milAbroad(s);
  return (
    `올해 김천 상무 선수 모집 공고가 났습니다. 입영 연기 기한(만 ${MIL_AGE}세)까지 ${left}년.` +
    (abroad ? ` 해외파는 국내 경기 기록이 부족해 심사에서 불리하고, 합격하면 ${s.club.name}과(와)의 계약을 해지하고 귀국해야 합니다.` : ' K리그 소속 선수는 출전 기록 심사에서 유리합니다.') +
    (hope.length ? ` 아직 ${hope.join(' · ')} 특례 기회가 남아 있습니다.` : '') +
    (sangmuChance(s) < MIL_LOW ? ' 냉정하게 보면 합격 가능성은 높지 않습니다.' : '')
  );
};
const MIL_APPLY = {
  label: (s: GameState) => `지원서를 낸다 (예상 합격률 ${Math.round(sangmuChance(s) * 100)}%)`,
  ok: {
    text: (s: GameState) => (milAbroad(s) ? '지원서를 제출했습니다. 구단은 떠날 준비를 하는 당신을 서운해합니다. 결과는 시즌이 끝난 뒤 발표됩니다.' : '지원서를 제출했습니다. 결과는 시즌이 끝난 뒤 발표됩니다. 마음이 한결 가벼워졌습니다.'),
    fx: (s: GameState) => { s.mil.applied = true; if (milAbroad(s)) addStat(s, 'trust', -2); else addStat(s, 'morale', 4); },
  },
};
const MIL_DEFER = {
  label: (s: GameState) => (milExemptHope(s).length ? '입영을 미루고 특례에 도전한다' : '입영을 미루고 커리어에 집중한다'),
  ok: {
    text: (s: GameState) => (milExemptHope(s).length ? '대표팀 명단과 메달을 향해 달립니다. 실패하면 기한에 쫓기게 됩니다.' : '올해는 지원하지 않습니다. 입영 기한이 한 해 더 가까워졌습니다.'),
    fx: (s: GameState) => { addStat(s, 'trust', 0.5); if (s.age >= MIL_AGE - 2) addStat(s, 'morale', -3); },
  },
};
const MIL_ARMY = {
  label: '시즌이 끝나면 현역으로 먼저 다녀온다',
  ok: {
    text: '젊을 때 빨리 해결하기로 했습니다. 시즌이 끝나면 입대합니다. 18개월의 공백은 각오해야 합니다.',
    fx: (s: GameState) => { s.mil.armyNext = true; addStat(s, 'morale', 2); },
  },
};
EVENTS.push(
  { id: 'mil-notice', title: '국군체육부대 선수 모집 공고', w: 0, chain: true, cond: (s) => milCanApply(s) && sangmuChance(s) >= MIL_LOW, text: milNoticeText, choices: [MIL_APPLY, MIL_DEFER] },
  { id: 'mil-notice-low', title: '국군체육부대 선수 모집 공고', w: 0, chain: true, cond: (s) => milCanApply(s) && sangmuChance(s) < MIL_LOW, text: milNoticeText, choices: [MIL_APPLY, MIL_DEFER, MIL_ARMY] },
);
