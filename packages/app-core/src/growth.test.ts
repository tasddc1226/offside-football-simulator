import { SeasonGrowthSchema } from '@offside/contracts';
import { ovr, SUB_KEYS } from '@offside/game/attributes';
import * as g from '@offside/game/index';
import { createRng, setActiveRng } from '@offside/game/rng';
import type { GameState } from '@offside/game/types';
import { describe, expect, it } from 'vitest';
import { recordPhaseOvr, takeSeasonGrowth } from './growth.js';

const fresh = (seed = 11): GameState => {
  setActiveRng(createRng(seed));
  return g.newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
};

/** 한 시즌을 끝 직전까지 진행한다. record가 거짓이면 성장 기록 함수를 하나도 부르지 않는다. */
function playSeason(s: GameState, record: boolean) {
  for (let ph = 0; ph <= g.LAST_PHASE; ph++) {
    if (record) recordPhaseOvr(s);
    s.training = s.cond < 45 ? 'rest' : 'pac';
    const { ev } = g.playPhase(s);
    if (ev) g.resolveChoice(s, ev, 0);
  }
}

describe('T-11-048 시즌 성장 기록', () => {
  it('첫 시즌: 시작 OVR은 만든 직후 OVR이고, 구간별 OVR·시즌 끝 능력치가 계약을 통과한다', () => {
    const s = fresh();
    const created = ovr(s);
    playSeason(s, true);
    const end = { attrs: { ...s.attrs }, sub: { ...s.sub } };
    const growth = takeSeasonGrowth(s)!;
    expect(SeasonGrowthSchema.safeParse(growth).success).toBe(true);
    expect(growth.o0).toBe(created);
    expect(growth.ph).toHaveLength(3);
    expect(growth.ph[0]).toBe(created); // 프리시즌에 들어갈 때는 아직 아무것도 하지 않았다.
    expect(growth.s0).toHaveLength(SUB_KEYS.length);
    expect(growth.s1).toEqual(SUB_KEYS.map((k) => Math.round(end.sub[k]! * 10) / 10));
    expect(growth.a1).toEqual(
      [
        end.attrs.pac,
        end.attrs.sho,
        end.attrs.pas,
        end.attrs.dri,
        end.attrs.def,
        end.attrs.phy,
      ].map((v) => Math.round(v * 10) / 10),
    );
    expect(growth.pot).toEqual({ s: s.pot, b: 0, bl: s.bloom ?? 0, r: 0 });
    expect(s.ovrBuf).toEqual([]); // 다음 시즌을 위해 비운다.
  });

  it('endSeason이 시즌 시작 기록을 넘긴 뒤의 시즌도 새 시작 값으로 뜬다', () => {
    const s = fresh(21);
    playSeason(s, true);
    const first = takeSeasonGrowth(s)!;
    g.endSeason(s);
    const m = g.market(s);
    if (m.options.length) g.acceptOption(s, m.options[0]!);
    playSeason(s, true);
    const second = takeSeasonGrowth(s)!;
    expect(SeasonGrowthSchema.safeParse(second).success).toBe(true);
    expect(second.ph).toHaveLength(3);
    // 둘째 시즌의 시작 능력치는 첫 시즌 시작이 아니라 첫 시즌이 끝난 뒤의 값이다.
    expect(second.s0).not.toEqual(first.s0);
    expect(second.o0).toBeGreaterThanOrEqual(first.o0);
  });

  it('기록 함수는 게임 진행(RNG·상태)에 영향을 주지 않는다', () => {
    const a = fresh(33);
    playSeason(a, true);
    takeSeasonGrowth(a);
    const b = fresh(33);
    playSeason(b, false);
    // cid는 게임마다 새로 뽑는 UUID라 맞춘다.
    const strip = (x: GameState) => JSON.stringify({ ...x, cid: '', ovrBuf: undefined });
    expect(strip(a)).toBe(strip(b));
  });

  it('같은 구간을 다시 불러도(이어하기) 한 칸만 덮어쓴다', () => {
    const s = fresh();
    recordPhaseOvr(s);
    recordPhaseOvr(s);
    expect(s.ovrBuf).toHaveLength(1);
  });

  it('중간 구간이 빠졌으면 앞에서부터 이어진 구간만 싣는다', () => {
    const s = fresh();
    s.ovrBuf = [];
    s.ovrBuf[1] = 55;
    s.ovrBuf[2] = 56;
    expect(takeSeasonGrowth(s)!.ph).toEqual([]);
  });

  it('시즌 시작 기록이 없는 옛 저장은 싣지 않고 버퍼만 비운다', () => {
    const s = fresh();
    recordPhaseOvr(s);
    s.seasonStartSub = {};
    expect(takeSeasonGrowth(s)).toBeUndefined();
    expect(s.ovrBuf).toEqual([]);
  });

  it('T-11-083 첫 시즌엔 강화 기록이 없고, 강화를 할 수 있는 시즌부터 그 시즌의 시도·자금·비용을 싣는다', () => {
    const s = fresh();
    playSeason(s, true);
    expect(takeSeasonGrowth(s)!.bst).toBeUndefined();
    g.endSeason(s);
    s.money = 50_000;
    s.age = 21;
    s.contract = { years: 2, salary: 10_000 };
    playSeason(s, true);
    expect(g.tryBoost(s)).not.toBeNull();
    const growth = takeSeasonGrowth(s)!;
    expect(SeasonGrowthSchema.safeParse(growth).success).toBe(true);
    expect(growth.bst).toEqual({
      l: s.boost!.lv,
      f: s.boost!.fails,
      m: s.money,
      c: g.boostCost(s),
      t: [{ lv: 0, p: 50, c: 7000, ok: s.boost!.lv === 1 }],
    });
  });
});
