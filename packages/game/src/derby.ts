// ───────── 라이벌 더비의 상대와 이름 (T-11-543) ─────────
// 예전엔 리그마다 더비 이름이 하나뿐이고 상대 구단이 나오지 않아 몇 번을 겪어도 같은 장면이었다. 이제 리그마다
// 실제로 맞붙는 두 구단(클럽 배열 위치)과 이름을 3~4개 두고, 내 구단이 그중 하나에 들면 그 더비가, 아니면 커리어 ·
// 구단마다 정해지는 라이벌 구단과의 라이벌전이 나온다. 이름은 i18n/ko/gVariety.ts DERBY_NAMES(같은 순서)에 있다.
//
// 문구 함수에서 부르므로 게임 RNG를 쓰지 않는다 — 커리어 ID · 연도 해시로만 고른다(언어가 결과를 바꾸면 안 된다).
import { clubIdOf } from '@offside/contracts/club-names';
import { hashStr } from './hash.js';
import { clubsIn } from './player.js';
import { gVarietyText as V } from './i18n/ko/gVariety.js';
import type { GameState } from './types.js';

/** 리그 id → 더비를 이루는 두 구단의 배열 위치(@offside/contracts/club-names CLUB_NAMES). 이 리그들에서만 더비 이벤트가 나온다. */
export const DERBY_PAIRS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  k2: [
    [0, 6],
    [1, 7],
    [9, 10],
    [3, 7],
  ],
  k1: [
    [0, 2],
    [0, 1],
    [3, 9],
    [3, 5],
  ],
  j1: [
    [4, 9],
    [8, 12],
    [9, 13],
    [0, 2],
  ],
  mls: [
    [3, 21],
    [10, 16],
    [7, 12],
    [20, 29],
  ],
  ere: [
    [0, 2],
    [0, 1],
    [2, 9],
    [8, 11],
  ],
  l1: [
    [0, 1],
    [0, 12],
    [3, 6],
    [2, 5],
  ],
  bl: [
    [0, 1],
    [14, 16],
    [8, 15],
    [11, 14],
  ],
  sa: [
    [0, 3],
    [5, 6],
    [1, 10],
    [0, 1],
  ],
  ll: [
    [0, 1],
    [0, 2],
    [5, 7],
    [3, 6],
  ],
  pl: [
    [0, 4],
    [1, 14],
    [2, 5],
    [1, 4],
  ],
  csl: [
    [0, 1],
    [7, 13],
    [3, 5],
    [1, 3],
  ],
  spl: [
    [0, 1],
    [2, 3],
    [0, 2],
  ],
  bra: [
    [0, 4],
    [8, 15],
    [1, 12],
    [2, 10],
  ],
  por: [
    [0, 1],
    [0, 2],
    [3, 4],
    [1, 3],
  ],
};

export interface DerbyPick {
  /** DERBY_PAIRS[리그]의 몇 번째 더비인지. 내 구단이 어느 더비에도 들지 않으면 null(라이벌전). */
  k: number | null;
  /** 상대 구단의 지금 이름(유저가 바꾼 이름 포함, 저장값 그대로 — 그릴 때 tn()). */
  opp: string;
}

/**
 * 이번 더비의 상대. 내 구단이 든 더비가 여럿이면 커리어 ID · 연도로 번갈아 고르고, 하나도 없으면 커리어 ID · 구단으로
 * 정한 라이벌(같은 리그의 다른 구단)이 상대다 — 한 구단에 있는 동안은 같은 라이벌이다.
 */
export function derbyOf(s: GameState): DerbyPick | null {
  const pairs = DERBY_PAIRS[s.leagueId];
  if (!pairs) return null;
  const clubs = clubsIn(s.leagueId, s);
  const nameOf = new Map(clubs.map((c) => [c.id, c.name]));
  const mine = pairs
    .map(([a, b], k) => ({ k, a: clubIdOf(s.leagueId, a), b: clubIdOf(s.leagueId, b) }))
    .filter((d) => (d.a === s.club.id || d.b === s.club.id) && nameOf.has(d.a) && nameOf.has(d.b));
  if (mine.length) {
    const d = mine[hashStr(`${s.cid}:derby:${s.year}`) % mine.length]!;
    return { k: d.k, opp: nameOf.get(d.a === s.club.id ? d.b : d.a)! };
  }
  const others = clubs.filter((c) => c.id !== s.club.id);
  if (!others.length) return null;
  return { k: null, opp: others[hashStr(`${s.cid}:rival:${s.club.id}`) % others.length]!.name };
}

/** 더비 장면 첫 문장 — 내 구단이 든 더비면 그 이름과 상대, 아니면 라이벌 구단과의 라이벌전(지금 언어로). name은 구단 이름을
 * 그릴 때 거치는 함수(영어 · 일본어 문구는 tn). */
export function derbyText(s: GameState, name = (c: string) => c): string {
  const d = derbyOf(s);
  if (!d) return V.rivalText({ opp: '' });
  const opp = name(d.opp);
  return d.k === null
    ? V.rivalText({ opp })
    : V.derbyText({ name: V.derbyName({ league: s.leagueId, k: d.k }), opp });
}
