// ───────── T-11-390 결정적 장면 (선수 커리어) ─────────
// 리그 구간마다 한 번, 컵 · 대륙 대회 결승에서 한 번 중계가 멈추고 내 선수의 찬스(공격수 · 미드필더) 또는 위기(수비수 · 골키퍼)에서
// 선택지를 고른다. 결과는 그 경기가 이미 쓰는 난수 하나에 묶는다 — 고른 선택지는 성공 기준선만 옮기고, 감독에게 맡기면(auto)
// 기준선이 그대로라 장면이 없던 때와 결과 · 난수 순서가 똑같다(golden.test.ts가 그대로다). 찬스는 그 경기 골(미드필더는 골 · 도움)에
// 묶는데, 골 수를 바꾸지 않고 나머지 난수를 같게 두려고 장면 몫의 난수는 게임 RNG가 아닌 커리어 · 시즌 · 구간 해시 시드로 굴린다.
// 장면은 화면 설명용이라 세이브에 남지 않는다. 선택은 화면이 구간을 처음 상태에서 다시 진행하며 넘긴다(playPhase의 momentHooks).
// 엔진(match · comps)은 이 파일의 타입만 쓰고, 장면을 여는 momentHooks는 화면이 구간 진행 때 불러와 넘긴다 — 넘기지 않으면(시뮬레이터 ·
// 골든) 장면이 없고 결과는 맡겼을 때와 같다. 장면 종류 · 선택지 · 확률 표는 moment-choices.ts에 있고, 엔진은 고른 확률만 받는다.
import { clamp, createRng, hashStr } from './rng.js';
import type { GameState } from './types.js';

export type MomentKind = 'chance' | 'crisis';
/** 고른 선택지 — 성공 확률과, 슈팅 선택지인지(미드필더 찬스가 골인지 도움인지 정한다). */
export interface MomentPick {
  pct: number;
  shot?: boolean;
}
/** 장면 키 → 고른 선택지. 없으면 감독에게 맡긴다(성공 확률 = base). */
export type MomentPicks = Record<string, MomentPick>;
export interface CareerMoment {
  /** 선택을 넘기는 키 — 리그는 'league', 결승은 'final:<대회 저장 이름>'. */
  key: string;
  at: 'league' | 'final';
  kind: MomentKind;
  /** 리그: BlockResult.games 순번 · 라운드. */
  game?: number;
  rd?: number;
  /** 결승: 대회 저장 이름(한국어, 그릴 때 tn). */
  comp?: string;
  opp?: string;
  /** 장면(상황)을 고르는 난수(0~1, moment-choices situationOf). */
  sit: number;
  /** 맡겼을 때 성공 확률. */
  base: number;
  /** 이번 진행에 쓴 성공 확률(맡기면 base). */
  pct: number;
  picked: boolean;
  shot: boolean;
  ok: boolean;
  /** 찬스 결과로 더해지거나 빠진 기록(리그 찬스만). */
  gain?: 'g' | 'a';
  loss?: 'g' | 'a';
}

/**
 * T-11-394 장면 기록 한 줄(GameState.momentBuf → 시즌 업로드 성장 기록 km). 확률은 % 정수.
 * c: 고른 선택지 id, 'auto'(감독에게 맡기기), 'to'(시간 초과로 맡김).
 */
export interface MomentLog {
  /** 구간(1 전반기 · 2 후반기). */
  ph: number;
  at: 'l' | 'f';
  /** 장면(moment-choices CAREER_SITUATIONS 키). */
  sit: string;
  c: string;
  /** 맡겼을 때 확률 · 이번에 쓴 확률. */
  b: number;
  p: number;
  ok: boolean;
}

type At = Pick<CareerMoment, 'game' | 'rd' | 'comp' | 'opp'>;
/** 엔진이 장면을 여는 자리. moments에 연 순서(리그 → 결승)로 쌓인다. */
export interface MomentHooks {
  moments: CareerMoment[];
  /** 리그 구간(n경기)의 i번째 경기에서 장면을 열 차례인지(뛴 경기에서만 부른다). */
  due(i: number, n: number): boolean;
  /**
   * 리그 찬스: 이 경기 골(미드필더는 골 · 도움, 기대값 lg · la)이 났는지에 묶은 장면 난수로 성공을 정하고, 바뀐 골 · 도움을 돌려준다.
   * 성공했는데 기록이 없으면 하나 더하고(공격수 · 슈팅 선택지는 골, 아니면 도움), 실패했는데 기록이 있으면 하나 뺀다.
   */
  chance(
    at: At,
    lg: number,
    la: number,
    g: number,
    a: number,
  ): { moment: CareerMoment; g: number; a: number };
  /** 리그 위기 · 결승: 장면만 연다(성공은 그 경기 난수와 m.pct로 엔진이 정한다). */
  open(at: At, base: number, final?: boolean): CareerMoment;
}

/** 장면 몫 난수(게임 RNG와 따로) — 같은 커리어 · 시즌 · 구간 · 장면이면 같은 수열. */
const momentRng = (s: GameState, key: string): (() => number) =>
  createRng(hashStr(`${s.cid}:${s.year}:${s.phase}:${key}`)).next;

/** 구간 하나를 진행할 장면 자리. picks는 장면 키 → 고른 선택지(없으면 맡긴다). */
export function momentHooks(s: GameState, picks: MomentPicks = {}): MomentHooks {
  const moments: CareerMoment[] = [];
  const league = momentRng(s, 'league');
  let target = -1;
  const make = (key: string, r: () => number, at: At, base: number): CareerMoment => {
    const p = picks[key];
    const m: CareerMoment = {
      key,
      at: key === 'league' ? 'league' : 'final',
      ...at,
      kind: s.pos === 'DF' || s.pos === 'GK' ? 'crisis' : 'chance',
      sit: r(),
      base,
      pct: p ? clamp(p.pct, 0, 1) : base,
      picked: !!p,
      shot: !!p?.shot,
      ok: false,
    };
    moments.push(m);
    return m;
  };
  return {
    moments,
    due(i, n) {
      // 구간 30~80% 사이에서 고른 경기부터 처음으로 뛴 경기에서 한 번.
      if (target < 0) target = Math.floor(n * (0.3 + league() * 0.5));
      return i >= target && !moments.some((m) => m.key === 'league');
    },
    chance(at, lg, la, g, a) {
      const fw = s.pos === 'FW';
      const base = 1 - Math.exp(-(fw ? lg : lg + la));
      const scored = fw ? g > 0 : g + a > 0;
      const m = make('league', league, at, base);
      const v = league();
      m.ok = (scored ? v * base : base + v * (1 - base)) < m.pct;
      if (m.ok && !scored) {
        m.gain = fw || m.shot ? 'g' : 'a';
        if (m.gain === 'g') g++;
        else a++;
      } else if (!m.ok && scored) {
        m.loss = !fw && a > 0 && !m.shot ? 'a' : g > 0 ? 'g' : 'a';
        if (m.loss === 'g') g--;
        else a--;
      }
      return { moment: m, g, a };
    },
    open(at, base, final) {
      const key = final ? `final:${at.comp}` : 'league';
      return make(key, final ? momentRng(s, key) : league, at, base);
    },
  };
}
