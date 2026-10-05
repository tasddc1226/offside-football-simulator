// ───────── 핵심 시뮬레이션 엔진 (engine.js 포트): 새 커리어 생성 + 역할별 모듈 다시 내보내기 ─────────
// T-10-046: 역할별 모듈로 나눴다 — 조회·파생 값(player), 상태 변경(stats), 훈련(training), 경기 구간(match),
// 순위(table), 스토리/체인(story), 이벤트 헬퍼·추첨·해결(event-runner). 이 모듈은 새 커리어 생성만 남기고
// 나머지를 그대로 다시 내보내 기존 import 경로(`./engine.js`)를 유지한다.
import {
  POS,
  TYPES,
  ATTR_KEYS,
  SAVE_VERSION,
  focusMod,
  focusOfType,
  posLabel,
  DPOS,
  type DetailPos,
  typeForFocus,
  type AttrKey,
  type Pos,
} from './data.js';
import { ovr, initSubs, legacyOvr, peakProfileOf } from './attributes.js';
import { clamp, ri, pick, gauss } from './rng.js';
import { adoptLatestBalance, applyLatestBalance, BAL } from './balance.js';
import type { GameState, Season, LogEntry } from './types.js';
import { leagueOf, clubsIn } from './player.js';
import { log } from './stats.js';
import { nationOf } from './nation.js';
import { DEFAULT_NATION } from '@offside/contracts/nations';
import type { Body } from '@offside/contracts/body';
import { PRESEASON_RETIRE_AT } from '@offside/contracts/service-seasons';
import { PRESEASON_POT } from '@offside/contracts/balance';

export * from './player.js';
export * from './stats.js';
export * from './training.js';
export * from './boost.js';
export * from './match.js';
export * from './table.js';
export * from './story.js';
export * from './event-runner.js';

// ───────── 새 커리어 ─────────
// T-10-002: presetAttrs가 주어지면(선수 생성 후보 카드에서 고른 분포) ri(-4,4) 루프를 건너뛰고
// 그 값을 그대로 쓴다 — presetAttrs를 넘기지 않는 기존 호출(특히 tooling/fulltime-sim이 직접
// 부르는 경로)은 RNG 소비 순서가 한 글자도 바뀌지 않는다(결정성/패리티 보존).
// T-10-008: 화면은 focus(주력 능력치)를 넘기고 type은 그 조합에서 파생한다. type만 넘기는 기존
// 호출(시뮬레이터·테스트)은 유형 mod·RNG 소비가 그대로이고, focus는 유형에서 거꾸로 구한다.
export function newGame(
  o: {
    name: string;
    number: number;
    pos: Pos;
    /** T-10-091 세부 포지션(시즌 1부터). 없으면 옛 방식 그대로 — RNG 소비 순서도 같다. */
    dpos?: DetailPos | undefined;
    /** T-10-096 국적·체격. 없으면(또는 대한민국이면) 예전과 같은 선수 — RNG 소비 순서도 같다. */
    nation?: string | undefined;
    body?: Body | undefined;
    /** T-11-045 은퇴 나이(서비스 시즌 retireAt). 없거나 프리시즌 값이면 예전과 같은 선수 — RNG도 쓰지 않는다. */
    retireAt?: number | undefined;
    foot: GameState['foot'];
    trait: string;
  } & ({ type: string; focus?: undefined } | { type?: undefined; focus: AttrKey[] }),
  seed: number,
  presetAttrs?: Record<AttrKey, number>,
): GameState {
  const attrs = {} as Record<AttrKey, number>;
  const typeId = o.focus ? typeForFocus(o.pos, o.focus) : o.type;
  const focus = o.focus ? [...o.focus] : focusOfType(o.pos, typeId);
  const mod = o.focus ? focusMod(o.pos, o.focus) : TYPES[o.pos].find((t) => t.id === typeId)!.mod;
  const dmod = o.dpos ? DPOS[o.dpos].mod : {};
  if (presetAttrs) {
    for (const k of ATTR_KEYS) attrs[k] = clamp(presetAttrs[k], 20, 70);
  } else {
    for (const k of ATTR_KEYS)
      attrs[k] = clamp(POS[o.pos].base[k] + (mod[k] ?? 0) + (dmod[k] ?? 0) + ri(-4, 4), 20, 70);
  }
  const club = pick(clubsIn('hs'));
  // 잠재력 추첨은 첫 시즌(newSeason) 전이라 최신 서버 밸런스를 먼저 맞춘다 — RNG는 쓰지 않는다.
  applyLatestBalance();
  // T-11-093 시즌에 만든 선수만 서버 설정(기본 75·6)으로 뽑는다. 프리시즌 선수는 예전 값 그대로.
  const retireAt = o.retireAt !== PRESEASON_RETIRE_AT ? o.retireAt : undefined;
  const potDraw = retireAt ? { mean: BAL.potMean, sd: BAL.potSd } : PRESEASON_POT;
  const pot = clamp(Math.round(potDraw.mean + gauss() * potDraw.sd), 55, 96);
  const scouted = clamp(Math.round(pot + gauss() * BAL.potScoutSd), 55, 96);
  // sub/season/seasonStartSub은 initSubs()/newSeason() 호출로만 실제 값이 정해진다(둘 다 RNG를
  // 소모하므로, 그 호출 순서를 바꾸지 않기 위해 이 시점엔 아직 실행하지 않는다). 여기서는 타입을
  // 만족하는 빈 기본값을 채워 두고, 아래에서 원래 순서 그대로 덮어쓴다 — 캐스팅(타입 우회) 없이도
  // 리터럴이 GameState를 완전히 만족한다.
  const s: GameState = {
    // cid는 crypto.randomUUID()로 만든다 — 시드 RNG(rnd/ri/gauss 등)를 절대 소모하지 않는다.
    v: SAVE_VERSION,
    cid: crypto.randomUUID(),
    halves: 1,
    name: o.name,
    number: o.number,
    pos: o.pos,
    ...(o.dpos && { dpos: o.dpos }),
    ...(o.nation && o.nation !== DEFAULT_NATION && { nation: o.nation }),
    ...(o.body && { body: { ...o.body } }),
    ...(retireAt && { retireAt }),
    foot: o.foot,
    type: typeId,
    focus,
    trait: o.trait,
    age: 18,
    year: 2026,
    attrs,
    sub: {},
    pot: scouted,
    bloom: pot - scouted,
    cond: 90,
    morale: 70,
    fame: 3,
    trust: 0,
    money: 300,
    leagueId: 'hs',
    club: { ...club },
    contract: null,
    phase: 0,
    uniYears: 0,
    season: {
      apps: 0,
      starts: 0,
      goals: 0,
      assists: 0,
      ratingSum: 0,
      cs: 0,
      mins: 0,
      played: 0,
      pts: 0,
      w: 0,
      d: 0,
      l: 0,
      rivals: [],
      honors: [],
    },
    seasonStart: { ...attrs },
    seasonStartSub: {},
    career: [],
    trophies: [],
    awards: [],
    titles: [],
    nat: {
      caps: 0,
      goals: 0,
      assists: 0,
      tours: [],
      // 2026 월드컵 본선 — 외국 국적은 전력으로 정한다(시드 RNG를 쓰지 않는다).
      qual: { 2026: nationOf(o).str >= 70 },
      captain: false,
      debutYear: null,
    },
    mil: { exempt: null, served: false, serving: false, left: 0, type: null, prevClub: null },
    injury: 0,
    log: [] as LogEntry[],
    pending: null,
    flags: {},
    peak: 0,
    training: 'rest',
    retired: false,
    chains: [],
    story: {},
    storyLog: [],
    rng: { seed },
  };
  initSubs(s, attrs, legacyOvr(o.pos, attrs));
  s.seasonStart = { ...s.attrs };
  s.seasonStartSub = { ...s.sub };
  s.peak = ovr(s);
  s.peakProfile = peakProfileOf(s);
  s.season = newSeason(s);
  log(
    s,
    `${s.nation ? `${nationOf(s).ko}에서 축구 유학을 온 ` : ''}${club.name} 3학년 ${posLabel(s)} ${s.name}, 등번호 ${s.number}번으로 축구 커리어를 시작합니다.`,
    'big',
  );
  return s;
}

export function newSeason(s: GameState): Season {
  // T-10-016 서버의 새 밸런스 버전은 시즌이 바뀔 때만 커리어에 들어온다.
  if (adoptLatestBalance(s) && s.career.length)
    log(s, `밸런스 패치 v${s.bal!.v}가 이번 시즌부터 적용됩니다.`);
  const L = leagueOf(s.leagueId);
  const rivals: number[] = [];
  for (let i = 0; i < 19; i++) rivals.push(L.avg + gauss() * L.spread);
  return {
    apps: 0,
    starts: 0,
    goals: 0,
    assists: 0,
    ratingSum: 0,
    cs: 0,
    mins: 0,
    played: 0,
    pts: 0,
    w: 0,
    d: 0,
    l: 0,
    rivals,
    honors: [],
  };
}
