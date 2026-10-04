import { describe, expect, it } from 'vitest';
import * as g from './index.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { eventById } from './events-data.js';
import { canAcceptRenewal, offerFrom } from './season.js';
import { milSeasonEnd, SANGMU } from './military.js';
import { loadSave } from './save.js';
import type { GameState, RenewOption } from './types.js';

function player(age = 26, years = 1, retireAt = 45): GameState {
  setActiveRng(createRng(11));
  const s = g.newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late', retireAt },
    11,
  );
  g.endSeason(s);
  s.age = age;
  s.leagueId = 'k3';
  s.club = { ...g.CLUBS.find((c) => c.leagueId === 'k3')!, str: g.ovr(s) };
  s.contract = { years, salary: 1000 };
  s.mil.served = true;
  s.trust = 2;
  s.phase = 3;
  return s;
}

function renewal(s: GameState): RenewOption | undefined {
  return g.market(s).options.find((o): o is RenewOption => o.kind === 'renew');
}

describe('T-11-054 마지막 계약 시즌 시작 전 조기 연장', () => {
  it('시즌 결산의 2→1 뒤 조기 제안, 1→0 뒤 기존 만료 재계약을 구분한다', () => {
    for (const years of [2, 1]) {
      const s = player(26, years);
      g.endSeason(s);
      expect(s.contract!.years).toBe(years - 1);
      const m = g.market(s);
      const r = m.options.find((o) => o.kind === 'renew') as RenewOption;
      expect(r).toBeDefined();
      expect(!!r.extension).toBe(years === 2);
      expect(m.options.some((o) => o.kind === 'stay')).toBe(years === 2);
    }
  });

  it('잔여 1년만 제안하고 적격 OVR 경계는 기존 전력 차 7을 쓴다', () => {
    expect(renewal(player(26, 2))).toBeUndefined();
    const s = player();
    s.club.str = g.ovr(s) + 7;
    expect(renewal(s)?.extension).toBeDefined();
    s.club.str++;
    expect(renewal(s)).toBeUndefined();
    s.leagueId = 'hs';
    expect(renewal(s)).toBeUndefined();
  });

  it('추가기간은 30세까지 2~4년, 31~37세 1년이며 잔여 1년을 포함한다', () => {
    for (const age of [26, 30, 31, 37]) {
      const r = renewal(player(age))!;
      const extra = r.extension!.years;
      expect(extra).toBeGreaterThanOrEqual(age < 31 ? 2 : 1);
      expect(extra).toBeLessThanOrEqual(age < 31 ? 4 : 1);
      expect(r.years).toBe(1 + extra);
    }
  });

  it('38~40세 공백과 41세 이상 매년 1년 심사를 유지한다', () => {
    for (const age of [38, 39, 40, 41, 44]) expect(renewal(player(age))).toBeUndefined();
    for (const age of [38, 39, 40]) expect(renewal(player(age, 0))).toBeUndefined();
    const vet = player(41, 0);
    Object.assign(vet.career.at(-1)!, { apps: 10, rating: 6.8, mil: false });
    expect(renewal(vet)).toMatchObject({ years: 1, desc: '베테랑 재계약' });
    vet.career.at(-1)!.apps = 9;
    expect(renewal(vet)).toBeUndefined();
  });

  it('은퇴 상한이 임박하면 추가기간을 줄이고 더 뛸 여유가 없으면 제안하지 않는다', () => {
    expect(renewal(player(30, 1, 33))).toMatchObject({ years: 3, extension: { years: 2 } });
    expect(renewal(player(30, 1, 31))).toBeUndefined();
    const s = player(30, 1, 30);
    expect(g.market(s).options).toEqual([]);
    const old = player(40, 1, 41);
    for (let seed = 0; seed < 10; seed++) {
      setActiveRng(createRng(seed));
      expect(
        offerFrom(
          old,
          g.CLUBS.find((c) => c.leagueId === 'k1')!,
        ).years,
      ).toBe(1);
    }
  });

  it('조기 제안을 추가해도 기존 제의·RNG·능력치·잠재력을 바꾸지 않는다', () => {
    const a = player(26, 1);
    const b = structuredClone(a);
    b.contract!.years = 2;
    const before = { sub: structuredClone(a.sub), pot: a.pot, bloom: a.bloom };
    setActiveRng(createRng(9));
    const ma = g.market(a);
    const ra = getActiveRng().getState();
    setActiveRng(createRng(9));
    const mb = g.market(b);
    expect(getActiveRng().getState()).toEqual(ra);
    expect(ma.options.filter((o) => o.kind === 'offer')).toEqual(
      mb.options.filter((o) => o.kind === 'offer'),
    );
    expect({ sub: a.sub, pot: a.pot, bloom: a.bloom }).toEqual(before);
  });

  it('잔류는 계약을 보존하고, 타 구단 선택은 조기 제안과 독립적으로 이적한다', () => {
    for (const kind of ['stay', 'offer']) {
      const s = player();
      s.fame = 300;
      setActiveRng(createRng(3));
      const m = g.market(s);
      expect(m.options.some((o) => o.kind === 'renew')).toBe(true);
      const opt = m.options.find((o) => o.kind === kind)!;
      expect(opt).toBeDefined();
      g.acceptOption(s, opt, m.options);
      if (opt.kind === 'offer') expect(s.club.id).toBe(opt.clubId);
      else expect(s.contract).toEqual({ years: 1, salary: 1000 });
    }
  });

  it('수락은 총기간·이번 시즌 연봉·신뢰 +1만 적용하고 같은 계약서를 재사용하지 못한다', () => {
    const s = player();
    const r = renewal(s)!;
    const money = s.money;
    g.acceptOption(s, r);
    expect(s.contract).toEqual({ years: r.years, salary: r.salary });
    expect(s.trust).toBe(3);
    expect(s.money).toBe(money);
    expect(s.phase).toBe(0);
    const after = structuredClone(s);
    expect(canAcceptRenewal(s, r)).toBe(false);
    g.acceptOption(s, r);
    expect(s).toEqual(after);
  });

  it('다른 연도·구단·상한 초과 제안은 부수효과 없이 거절한다', () => {
    for (const edit of [
      (s: GameState) => s.year++,
      (s: GameState) => {
        s.club.id = 'other';
      },
      (s: GameState) => {
        s.retireAt = s.age + 1;
      },
    ]) {
      const s = player();
      const r = renewal(s)!;
      edit(s);
      const before = structuredClone(s);
      g.acceptOption(s, r);
      expect(s).toEqual(before);
    }
  });

  it('옛 만료 제안과 새 조기 제안을 저장복원하며 새로 추첨하지 않는다', () => {
    for (const years of [0, 1]) {
      const s = player(26, years);
      s.pending = { type: 'market', res: null, m: g.market(s) };
      s.rng = getActiveRng().getState();
      const restored = loadSave(JSON.parse(JSON.stringify(s)))!.G;
      expect(restored.pending).toEqual(s.pending);
      expect(getActiveRng().getState()).toEqual(s.rng);
      const p = restored.pending!;
      if (p.type !== 'market') throw new Error('market');
      const r = p.m!.options.find((o) => o.kind === 'renew')!;
      g.acceptOption(restored, r);
      expect(restored.contract).toEqual({
        years: (r as RenewOption).years,
        salary: (r as RenewOption).salary,
      });
    }
  });

  it('차출 협상의 +1 뒤에는 잔여 2년이라 별도 조기 연장을 겹치지 않는다', () => {
    const s = player(23);
    const ev = eventById('ag-release')!;
    const c = ev.choices.find((c) => c.label === '재계약 조건으로 차출을 약속받는다')!;
    c.ok!.fx!(s);
    expect(s.contract!.years).toBe(2);
    expect(renewal(s)).toBeUndefined();
  });

  it('병역 시장을 우회하지 않고 상무 복귀 +1과 조기 제안을 구분한다', () => {
    const s = player(26);
    s.mil.served = false;
    s.mil.serving = true;
    s.mil.type = 'sangmu';
    s.mil.left = 1;
    s.mil.prevClub = {
      club: { ...s.club },
      leagueId: s.leagueId,
      contract: { ...s.contract! },
      abroad: false,
    };
    s.club = { ...SANGMU };
    s.leagueId = 'k1';
    expect(g.market(s).options.map((o) => o.kind)).toEqual(['serve']);
    milSeasonEnd(s);
    expect(s.contract!.years).toBe(2);
    expect(renewal(s)).toBeUndefined();
    s.contract!.years = 1;
    expect(renewal(s)?.extension).toBeDefined();
    s.mil.served = false;
    s.age = 28;
    expect(renewal(s)).toBeUndefined();
  });
});
