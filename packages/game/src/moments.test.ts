import { describe, expect, it } from 'vitest';
import './index.js';
import { LAST_PHASE, TYPES, type Pos } from './data.js';
import { newGame, resolveChoice } from './engine.js';
import { eventById } from './events-data.js';
import { CAREER_SITUATIONS, momentChoices, momentPick, situationOf } from './moment-choices.js';
import { momentHooks, type CareerMoment, type MomentPicks } from './moments.js';
import { leagueOf } from './player.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { acceptOption, endSeason, market } from './season.js';
import { playPhase } from './turn.js';
import type { GameState } from './types.js';

// T-11-390 결정적 장면 — 맡기면 장면이 없던 때와 같고, 고르면 그 장면만 바뀌며, 보여 준 확률이 실제 성공률과 맞는지 본다.
const start = (pos: Pos, seed: number) => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: 'a', number: 9, pos, foot: '오른발', type: TYPES[pos][0]!.id, trait: 'late' },
    seed,
  );
  // 장면 몫 난수는 cid로 시드를 잡는다. newGame의 cid는 무작위라 테스트마다 고정한다.
  s.cid = `moments-${pos}-${seed}`;
  return s;
};

/** 구간 전 상태 · 난수에서 picks로 한 구간을 진행한다(화면이 다시 진행하는 방식과 같다). null이면 장면 자리 없이. */
function replay(s0: GameState, rng: number, picks: MomentPicks | null = {}) {
  const s = structuredClone(s0);
  setActiveRng(createRng(rng));
  const r = playPhase(s, picks ? momentHooks(s, picks) : undefined);
  return { s, r, rng: getActiveRng().getState().seed };
}

/** 커리어를 seasons 시즌 진행하며 구간마다 visit(구간 전 상태, 구간 전 난수)를 부른다. */
function walk(pos: Pos, seed: number, seasons: number, visit: (s: GameState, rng: number) => void) {
  const s = start(pos, seed);
  for (let y = 0; y < seasons && !s.retired; y++) {
    for (let ph = 0; ph <= LAST_PHASE; ph++) {
      visit(structuredClone(s), getActiveRng().getState().seed);
      const { ev } = playPhase(s);
      if (ev) resolveChoice(s, ev, eventById(ev)!.choices.length - 1);
    }
    endSeason(s);
    const m = market(s);
    const stay = m.options.find((o) => o.kind === 'stay' || o.kind === 'renew') ?? m.options[0];
    if (stay) acceptOption(s, stay, m.options);
  }
}

/** 장면 선택지(구간 전 상태의 능력치로). */
const choicesOf = (s: GameState, m: CareerMoment) => momentChoices(s, m, leagueOf(s.leagueId).avg);
const best = (s: GameState, m: CareerMoment) =>
  [...choicesOf(s, m)].sort((a, b) => b.pct - a.pct)[0]!;

describe('T-11-390 결정적 장면', () => {
  it('리그 구간마다 장면이 하나 있고, 포지션에 맞는 찬스 · 위기다', () => {
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as const) {
      let blocks = 0,
        withMoment = 0;
      walk(pos, 11, 3, (s, rng) => {
        const { r } = replay(s, rng);
        if (!r.block?.apps) return;
        blocks++;
        const m = r.block.moment;
        if (!m) return;
        withMoment++;
        expect(m.key).toBe('league');
        expect(CAREER_SITUATIONS[situationOf(m, pos)]!.pos).toContain(pos);
        expect(m.kind).toBe(pos === 'DF' || pos === 'GK' ? 'crisis' : 'chance');
        expect(m.picked).toBe(false);
        expect(m.pct).toBe(m.base);
        expect(r.block.games[m.game!]!.rd).toBe(m.rd);
        expect(r.block.games[m.game!]!.mins).toBeGreaterThan(0);
        expect(r.moments[0]).toBe(m);
      });
      expect(withMoment).toBeGreaterThan(blocks * 0.7);
    }
  });

  it('장면 자리가 없거나 맡기면 상태 · 난수가 같다', () => {
    walk('FW', 21, 2, (s, rng) => {
      const a = replay(s, rng);
      const none = replay(s, rng, null);
      expect(none.s).toEqual(a.s);
      expect(none.rng).toBe(a.rng);
      expect(none.r.moments).toEqual([]);
      const m = a.r.block?.moment;
      const b = replay(s, rng, m ? { league: { pct: m.base } } : {});
      expect(b.s).toEqual(a.s);
      expect(b.rng).toBe(a.rng);
    });
  });

  it('고르면 장면 경기만 바뀌고 다른 리그 경기는 그대로다', () => {
    let changed = 0;
    // T-11-543 이벤트가 늘어 같은 시드의 진행이 바뀌었다. 4시즌으로는 결과가 뒤집힌 장면이 하나도 없어 5시즌을 본다.
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as const)
      walk(pos, 31, 5, (s, rng) => {
        const a = replay(s, rng);
        const m = a.r.block?.moment;
        if (!m) return;
        for (const c of choicesOf(s, m)) {
          const b = replay(s, rng, { league: momentPick(c) });
          const mb = b.r.block!.moment!;
          expect(mb.sit).toBe(m.sit);
          expect(mb.picked).toBe(true);
          expect(mb.pct).toBe(c.pct);
          a.r.block!.games.forEach((g, i) => {
            if (i !== m.game) expect(b.r.block!.games[i]).toEqual(g);
          });
          if (mb.ok !== m.ok) changed++;
          // 찬스는 고른 결과만큼 골 · 도움이 하나 늘거나 준다.
          const ga = a.r.block!.games[m.game!]!,
            gb = b.r.block!.games[m.game!]!;
          const d = (gb.g ?? 0) + (gb.a ?? 0) - ((ga.g ?? 0) + (ga.a ?? 0));
          if (m.kind === 'chance') expect(d).toBe(mb.ok === m.ok ? 0 : mb.ok ? 1 : -1);
          else expect(d).toBe(0);
        }
      });
    expect(changed).toBeGreaterThan(0);
  });

  it('보여 준 확률이 실제 성공률과 맞는다(맡김 · 고름)', () => {
    for (const kind of ['chance', 'crisis'] as const) {
      let n = 0,
        expAuto = 0,
        okAuto = 0,
        expPick = 0,
        okPick = 0;
      const poses: Pos[] = kind === 'chance' ? ['FW', 'MF'] : ['DF', 'GK'];
      for (const pos of poses)
        for (let seed = 1; seed <= 80; seed++)
          walk(pos, 1000 + seed, 4, (s, rng) => {
            const a = replay(s, rng);
            const m = a.r.block?.moment;
            if (!m) return;
            n++;
            expAuto += m.base;
            okAuto += m.ok ? 1 : 0;
            const c = best(s, m);
            const b = replay(s, rng, { league: momentPick(c) });
            expPick += c.pct;
            okPick += b.r.block!.moment!.ok ? 1 : 0;
          });
      expect(n).toBeGreaterThan(1000);
      expect(Math.abs(okAuto - expAuto) / n).toBeLessThan(0.05);
      expect(Math.abs(okPick - expPick) / n).toBeLessThan(0.05);
    }
  }, 60_000);

  it('컵 · 대륙 대회 결승에 뛰면 결승 장면이 붙고, 고른 기준선으로 우승이 갈린다', () => {
    let finals = 0;
    for (let seed = 1; seed <= 40 && finals < 5; seed++)
      walk((['FW', 'MF', 'DF', 'GK'] as const)[seed % 4]!, 500 + seed, 6, (s, rng) => {
        const a = replay(s, rng);
        for (const m of a.r.moments.filter((x) => x.at === 'final')) {
          finals++;
          expect(m.key).toBe(`final:${m.comp}`);
          const line = a.r.comp.flatMap((c) => c.games).find((g) => g.stage === '결승');
          expect(line?.won).toBe(m.ok);
          const lo = [...choicesOf(s, m)].sort((x, y) => x.pct - y.pct)[0]!;
          const b = replay(s, rng, { [m.key]: momentPick(lo) });
          const mb = b.r.moments.find((x) => x.key === m.key)!;
          // 기준선이 내려가면 이긴 결승이 질 수는 있어도, 진 결승을 이기지는 않는다.
          if (!m.ok && lo.pct <= m.base) expect(mb.ok).toBe(false);
        }
      });
    expect(finals).toBeGreaterThan(0);
  }, 60_000);
});
