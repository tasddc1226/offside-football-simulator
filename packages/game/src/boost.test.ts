import { describe, expect, it } from 'vitest';
import { applyBalance } from './balance.js';
import {
  BOOST_MAX,
  boostChance,
  boostCost,
  boostExtraLeft,
  boostFreeOpen,
  boostStatus,
  tryBoost,
} from './boost.js';
import { newGame } from './engine.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import type { CareerRecord, GameState } from './types.js';

function player(o: { seasons?: number; money?: number; salary?: number; age?: number } = {}) {
  setActiveRng(createRng(7));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
  s.career = Array.from({ length: o.seasons ?? 1 }, () => ({}) as CareerRecord);
  s.money = o.money ?? 1e6;
  s.age = o.age ?? 21;
  s.contract = o.salary == null ? null : { years: 2, salary: o.salary };
  return s;
}
/** 다음 난수가 성공(0)·실패(0.999…)가 되게 RNG를 바꾼다. */
const nextRoll = (v: number) =>
  setActiveRng({ ...createRng(1), next: () => v } as ReturnType<typeof createRng>);

describe('T-11-083 잠재력 강화', () => {
  it('첫 시즌 전·29세 초과·자금 부족이면 시도할 수 없고 상태를 바꾸지 않는다', () => {
    expect(boostStatus(player({ seasons: 0 }))).toBe('locked');
    expect(boostStatus(player({ age: 30 }))).toBe('aged');
    const poor = player({ money: 1999 });
    expect(boostStatus(poor)).toBe('short');
    expect(tryBoost(poor)).toBeNull();
    expect(poor.money).toBe(1999);
    expect(poor.boost).toBeUndefined();
  });

  it('비용은 최소 금액과 연봉 비례 중 큰 값이다', () => {
    expect(boostCost(player({ salary: 1000 }))).toBe(2000);
    expect(boostCost(player({ salary: 10000 }))).toBe(7000);
  });

  it('성공하면 자금을 쓰고 잠재력 보너스와 단계가 오른다. 같은 시즌엔 다시 못 한다', () => {
    const s = player({ salary: 10000, money: 50000 });
    const bonus = s.flags.potBonus ?? 0;
    nextRoll(0);
    const r = tryBoost(s)!;
    expect(r).toMatchObject({ ok: true, lv: 1, cost: 7000, chance: 50 });
    expect(s.money).toBe(43000);
    expect(s.flags.potBonus).toBe(bonus + 1);
    expect(s.boost).toMatchObject({ lv: 1, fails: 0, year: s.year });
    expect(s.boost!.log).toEqual([{ y: s.year, age: 21, lv: 0, p: 50, c: 7000, ok: true }]);
    expect(boostStatus(s)).toBe('done');
    expect(tryBoost(s)).toBeNull();
    s.year++;
    expect(boostStatus(s)).toBe('ready');
    expect(boostChance(s)).toBe(35);
  });

  it('실패하면 비용만 잃고 같은 단계의 다음 확률이 5%p 오른다', () => {
    const s = player({ salary: 10000, money: 50000 });
    nextRoll(0.999);
    expect(tryBoost(s)).toMatchObject({ ok: false, lv: 0 });
    expect(s.money).toBe(43000);
    expect(s.flags.potBonus ?? 0).toBe(0);
    s.year++;
    expect(boostChance(s)).toBe(55);
  });

  it('T-11-116 자금이 모자라면 광고로 자금 없이 한 번 시도하고, 자금이 충분하면 광고 시도는 못 한다', () => {
    const poor = player({ money: 1500 });
    const bonus = poor.flags.potBonus ?? 0;
    nextRoll(0);
    expect(tryBoost(poor, 'ad')).toMatchObject({ ok: true, lv: 1, cost: 0, chance: 50 });
    expect(poor.money).toBe(1500);
    expect(poor.flags.potBonus).toBe(bonus + 1);
    expect(poor.boost!.log).toEqual([
      { y: poor.year, age: 21, lv: 0, p: 50, c: 0, ok: true, ad: true },
    ]);
    // 시즌마다 한 번은 광고 시도도 같다(그 뒤는 T-11-157 추가 시도).
    expect(boostStatus(poor)).toBe('done');
    expect(boostExtraLeft(poor)).toBe(2);
    const rich = player({ money: 50000 });
    expect(tryBoost(rich, 'ad')).toBeNull();
    expect(rich.boost).toBeUndefined();
  });

  it('T-11-153 구단 자금으로도 자금 없이 한 번 시도하고, 기록에 구단 자금이라고 남긴다', () => {
    const poor = player({ money: 1500 });
    nextRoll(0.99);
    expect(tryBoost(poor, 'club')).toMatchObject({ ok: false, lv: 0, cost: 0, chance: 50 });
    expect(poor.money).toBe(1500);
    expect(poor.boost!.log).toEqual([
      { y: poor.year, age: 21, lv: 0, p: 50, c: 0, ok: false, club: true },
    ]);
    expect(boostStatus(poor)).toBe('done');
    expect(tryBoost(player({ money: 50000 }), 'club')).toBeNull();
  });

  it('T-11-157 자금이 모자란 시즌엔 그 시즌의 한 번 뒤 광고·구단 자금으로 더 시도하고, 한 커리어에서 모두 합쳐 두 번까지다', () => {
    const s = player({ salary: 10000, money: 50000 });
    // 자금이 충분한 시즌의 첫 시도는 선수 자금으로만 하고, 시도 뒤에도 자금이 되면 추가 시도는 없다.
    expect(boostFreeOpen(s)).toBe(false);
    expect(tryBoost(s, 'ad')).toBeNull();
    nextRoll(0.999);
    tryBoost(s);
    expect(s.money).toBe(43000);
    expect(boostExtraLeft(s)).toBe(0);
    expect(tryBoost(s, 'ad')).toBeNull();
    // 자금이 다음 비용(7,000)보다 모자라면 열린다.
    s.money = 6000;
    expect(boostExtraLeft(s)).toBe(2);
    expect(tryBoost(s)).toBeNull();
    nextRoll(0.999);
    expect(tryBoost(s, 'ad')).toMatchObject({ ok: false, lv: 0, cost: 0, chance: 55 });
    expect(s.money).toBe(6000);
    expect(boostExtraLeft(s)).toBe(1);
    // 다음 시즌: 그 시즌의 한 번은 따로 있고, 추가 시도는 커리어에 남은 한 번뿐이다.
    s.year++;
    nextRoll(0.999);
    tryBoost(s, 'club');
    expect(boostExtraLeft(s)).toBe(1);
    nextRoll(0);
    expect(tryBoost(s, 'club')).toMatchObject({ ok: true, lv: 1, cost: 0, chance: 65 });
    expect(s.boost!.log.slice(1).map((x) => [x.ad ?? x.club, x.x ?? false, x.ok])).toEqual([
      [true, true, false],
      [true, false, false],
      [true, true, true],
    ]);
    expect(boostExtraLeft(s)).toBe(0);
    expect(tryBoost(s, 'ad')).toBeNull();
    s.year++;
    nextRoll(0.999);
    tryBoost(s, 'ad');
    expect(boostExtraLeft(s)).toBe(0);
    expect(boostFreeOpen(s)).toBe(false);
  });

  it('T-11-157 추가 횟수는 밸런스 값을 따르고, 0이면 그 시즌의 한 번뿐이다', () => {
    const poor = player({ money: 1500 });
    // newGame이 최신 값을 다시 끼우므로 선수를 만든 뒤 바꾼다.
    applyBalance({ boostExtraTotal: 0 });
    try {
      nextRoll(0.999);
      tryBoost(poor, 'ad');
      expect(boostExtraLeft(poor)).toBe(0);
      expect(boostFreeOpen(poor)).toBe(false);
      expect(tryBoost(poor, 'club')).toBeNull();
    } finally {
      applyBalance();
    }
  });

  it('최대 단계에 닿으면 더 강화하지 않는다', () => {
    const s = player();
    s.boost = { lv: BOOST_MAX, fails: 0, log: [] };
    expect(boostStatus(s)).toBe('max');
    expect(boostCost(s)).toBe(0);
  });

  it('상태·비용·확률을 볼 때는 RNG를 쓰지 않는다', () => {
    const s: GameState = player({ salary: 5000 });
    const before = getActiveRng().getState();
    boostStatus(s);
    boostCost(s);
    boostChance(s);
    expect(getActiveRng().getState()).toEqual(before);
  });
});
