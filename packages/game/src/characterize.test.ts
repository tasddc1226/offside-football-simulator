import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ATTR_KEYS, LAST_PHASE, TRAITS, TYPES } from './data.js';
import { newGame, resolveChoice, rollEvent, simBlock } from './engine.js';
import { EVENTS } from './events-data.js';
import { natWindow } from './national.js';
import { compsPhase } from './comps.js';
import { createRng, pick, ri, setActiveRng } from './rng.js';
import { acceptOption, endSeason, market } from './season.js';
import { playPhase } from './turn.js';
import type { GameState } from './types.js';

// T-11-044 특성화 테스트 — 큰 함수(simBlock·endSeason·market·natWindow·rollEvent)를 쪼개기 전의 안전망.
// 골든(golden.test.ts)은 고정 시드 커리어의 최종 상태 하나만 보므로 그 길에 없는 분기(병역 마감·국가대표 단골·
// 드문 이벤트 선택지)는 못 잡는다. 여기서는 여러 커리어의 중간 상태를 모으고, 분기를 일부러 여는 변형
// (능력치 상향 = 대표팀, 28세 미필 = 병역)을 더한 뒤 함수마다 고정 RNG로 한 번씩 부른 결과를 해시로 고정한다.
// 해시가 바뀌면 그 함수의 결과나 RNG 소비 순서가 달라졌다는 뜻이다 — 의도한 밸런스 변경일 때만 `-u`로 갱신한다.

const CAREERS = 10;

// 실수는 유효숫자 10자리로 줄여 해시한다 — CI(x64)와 로컬(arm64)의 Math.log·exp 등이 끝자리에서 달라
// 흐름은 같아도 해시가 갈린다. 리팩터링 회귀(난수 순서·분기 변화)는 이 정도 반올림으로 가려지지 않는다.
const stable = (k: string, x: unknown): unknown =>
  k === 'cid' ? '' : typeof x === 'number' && !Number.isInteger(x) ? Number(x.toPrecision(10)) : x;

function hash(v: unknown): string {
  return createHash('sha256').update(JSON.stringify(v, stable)).digest('hex').slice(0, 16);
}
const clone = (s: GameState): GameState => structuredClone(s);
const attempt = <T>(fn: () => T): T | '!' => {
  try {
    return fn();
  } catch {
    return '!';
  }
};

interface Corpus {
  /** 구간 시작 직전(훈련·경기 전) 상태. */
  phase: GameState[];
  /** 시즌 마지막 구간을 마친 뒤, endSeason 직전 상태. */
  seasonEnd: GameState[];
}

function buildCorpus(): Corpus {
  const out: Corpus = { phase: [], seasonEnd: [] };
  for (let i = 0; i < CAREERS; i++) {
    const seed = 0xc0ffee + i * 104729;
    setActiveRng(createRng(seed));
    const pos = (['FW', 'MF', 'DF', 'GK'] as const)[i % 4]!;
    const types = TYPES[pos];
    const s = newGame(
      {
        name: 'CHAR',
        number: 7,
        pos,
        foot: i % 2 ? '오른발' : '왼발',
        type: types[(i * 3) % types.length]!.id,
        trait: TRAITS[(i * 5) % TRAITS.length]!.id,
      },
      seed,
    );
    for (let y = 0; y < 20 && !s.retired; y++) {
      for (let ph = 0; ph <= LAST_PHASE; ph++) {
        s.training = s.cond < 45 ? 'rest' : pick(ATTR_KEYS);
        out.phase.push(clone(s));
        const { ev } = playPhase(s);
        if (ev) resolveChoice(s, ev, ri(0, EVENTS.find((e) => e.id === ev)!.choices.length - 1));
      }
      out.seasonEnd.push(clone(s));
      endSeason(s);
      const m = market(s);
      const stay = m.options.find((o) => o.kind === 'stay' || o.kind === 'renew');
      const o = stay ?? m.options[0];
      if (!o || s.age >= 36) break;
      acceptOption(s, o, m.options);
      s.training = 'rest';
    }
  }
  return out;
}

/** 대표팀 단골이 되도록 능력치를 올린다. */
function star(s: GameState): GameState {
  for (const k of ATTR_KEYS) s.attrs[k] = Math.min(99, s.attrs[k] + 18);
  for (const k of Object.keys(s.sub)) s.sub[k] = Math.min(99, s.sub[k]! + 18);
  s.fame = Math.max(s.fame, 70);
  return s;
}
/** 병역 마감(28세 미필)에 걸리게 한다. */
function due(s: GameState): GameState {
  s.age = Math.max(s.age, 28);
  s.mil = { exempt: null, served: false, serving: false, left: 0, type: null, prevClub: null };
  return s;
}
const VARIANTS: [string, (s: GameState) => GameState][] = [
  ['원본', (s) => s],
  ['대표팀', star],
  ['병역', due],
];

/** 상태마다 다른 고정 시드로 fn을 부르고 (반환값, 바뀐 상태)를 해시로 모은다. */
function digest(states: GameState[], fn: (s: GameState) => unknown): { n: number; hash: string } {
  const rows = states.map((base, i) => {
    const s = clone(base);
    setActiveRng(createRng(0xbeef + i));
    const r = fn(s);
    return hash([r, s]);
  });
  return { n: rows.length, hash: hash(rows) };
}

// 상태 모음 전체를 여러 번 도는 무거운 테스트들이라 느린 CI 러너에선 vitest 기본 5초를 넘길 수 있다.
describe('게임 특성화 (T-11-044)', { timeout: 20_000 }, () => {
  const corpus = buildCorpus();
  const leaguePhases = corpus.phase.filter((s) => s.phase > 0);

  it('상태 모음이 고르게 모였다', () => {
    expect(corpus.phase.length).toBeGreaterThan(300);
    expect(corpus.seasonEnd.length).toBeGreaterThan(100);
  });

  it('T-11-186 대회 경기 줄은 출전·골·도움 집계와 같고, 승부마다 마지막 경기에 결과가 붙는다', () => {
    let lines = 0;
    for (const base of corpus.phase) {
      const s = clone(base);
      setActiveRng(createRng(s.year * 10 + s.phase));
      const before = (s.season.comps ?? []).map((c) => ({ apps: c.apps, g: c.g, a: c.a }));
      const out = compsPhase(s);
      const all = out.flatMap((l) => l.games);
      const comps = s.season.comps ?? [];
      const sum = (f: (c: { apps: number; g: number; a: number }, i: number) => number) =>
        comps.reduce((t, c, i) => t + f(c, i), 0);
      const was = (i: number) => before[i] ?? { apps: 0, g: 0, a: 0 };
      expect(all.filter((m) => m.mins).length).toBe(sum((c, i) => c.apps - was(i).apps));
      expect(all.reduce((t, m) => t + (m.mins ? m.g : 0), 0)).toBe(sum((c, i) => c.g - was(i).g));
      expect(all.reduce((t, m) => t + (m.mins ? m.a : 0), 0)).toBe(sum((c, i) => c.a - was(i).a));
      for (const l of out) {
        const ties = l.games.filter((m) => !m.res);
        for (const stage of new Set(ties.map((m) => m.stage))) {
          const matches = ties.filter((m) => m.stage === stage);
          expect(matches.at(-1)!.won).toBeTypeOf('boolean');
          expect(matches.slice(0, -1).every((m) => m.won === undefined)).toBe(true);
        }
        lines += l.games.length;
      }
    }
    expect(lines).toBeGreaterThan(50);
  });

  it('simBlock — 리그 구간 경기 결과', () => {
    expect({
      ...Object.fromEntries(
        VARIANTS.map(([name, v]) => [
          name,
          digest(
            leaguePhases.map((s) => v(clone(s))),
            simBlock,
          ),
        ]),
      ),
    }).toMatchSnapshot();
  });

  it('natWindow — A매치·국제대회 창', () => {
    expect(
      Object.fromEntries(
        VARIANTS.slice(0, 2).map(([name, v]) => [
          name,
          digest(
            corpus.phase.map((s) => v(clone(s))),
            natWindow,
          ),
        ]),
      ),
    ).toMatchSnapshot();
  });

  it('rollEvent — 이벤트 추첨', () => {
    const picked = new Set<string>();
    const d = digest(corpus.phase, (s) => {
      const ev = rollEvent(s);
      if (ev) picked.add(ev);
      return ev;
    });
    expect({ ...d, distinct: picked.size }).toMatchSnapshot();
  });

  it('endSeason — 시즌 정산(seasonAwards·natSeasonEnd·milSeasonEnd 포함)', () => {
    expect(
      Object.fromEntries(
        VARIANTS.map(([name, v]) => [
          name,
          digest(
            corpus.seasonEnd.map((s) => v(clone(s))),
            endSeason,
          ),
        ]),
      ),
    ).toMatchSnapshot();
  });

  it('market·acceptOption — 시장 선택지와 선택마다의 결과(병역 흐름 포함)', () => {
    const kinds = new Set<string>();
    const rows = VARIANTS.map(([name, v]) => {
      const after = corpus.seasonEnd.map((base, i) => {
        const s = v(clone(base));
        setActiveRng(createRng(0xfeed + i));
        endSeason(s);
        return s;
      });
      const options = digest(after, (s) => {
        const m = market(s);
        m.options.forEach((o) => kinds.add(o.kind));
        return m;
      });
      // 시장을 연 뒤 상태에서 선택지마다 따로 고른 결과.
      const accepted = digest(after, (s) => {
        const m = market(s);
        return m.options.map((_, k) => {
          const t = clone(s);
          const opts = structuredClone(m.options);
          setActiveRng(createRng(0xa11 + k));
          return [acceptOption(t, opts[k]!, opts), hash(t)];
        });
      });
      return [name, { options, accepted }];
    });
    expect({ ...Object.fromEntries(rows), kinds: [...kinds].sort() }).toMatchSnapshot();
  }, 20_000);

  it('이벤트 × 선택지 — 확률 p 격자와 선택 결과', () => {
    const pool = [
      ...corpus.phase,
      ...corpus.phase.filter((_, i) => i % 3 === 0).map((s) => star(clone(s))),
      ...corpus.phase.filter((_, i) => i % 3 === 1).map((s) => due(clone(s))),
    ];
    const table: Record<string, string> = {};
    let reached = 0;
    for (const ev of EVENTS) {
      const fits = pool.filter((s) => ev.cond(s));
      // p는 조건이 맞는 상태에서만 부른다. 이어지는 이야기(chain)는 앞 장면이 남긴 맥락을 읽어서 모음 상태에선
      // 던질 수 있다 — 던진 것도 그대로 '!'로 남긴다.
      const grid = ev.choices.map((c) =>
        c.p ? fits.map((s) => attempt(() => Math.round(c.p!(s) * 1e4))).join(',') : null,
      );
      // 조건이 맞는 상태 앞쪽 4개에서 선택지마다 고른 결과.
      const picks = fits.slice(0, 4).flatMap((base, i) =>
        ev.choices.map((_, k) => {
          const s = clone(base);
          setActiveRng(createRng(0x5e1 + i * 31 + k));
          return attempt(() => hash([resolveChoice(s, ev.id, k), s]));
        }),
      );
      if (fits.length) reached++;
      table[ev.id] = `${fits.length} ${hash([grid, picks])}`;
    }
    expect({ events: EVENTS.length, reached, table }).toMatchSnapshot();
  });
});
