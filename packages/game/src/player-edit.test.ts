import { describe, expect, it } from 'vitest';
import { BODY_LIMITS, bodyError, type Body } from '@offside/contracts/body';
import { DETAIL_GROUP, SELECTABLE_DETAIL_POSITIONS } from '@offside/contracts/positions';
import { ATTR_KEYS, LAST_PHASE, TRAITS, TYPES, type Pos } from './data.js';
import { mainRole, ovr, ovrRole, roleChoices } from './attributes.js';
import { newGame, resolveChoice } from './engine.js';
import { eventById } from './events-data.js';
import { endSeason } from './season.js';
import { playPhase } from './turn.js';
import { createRng, getActiveRng, pick, ri, setActiveRng } from './rng.js';
import {
  bodyEditable,
  editPlayerInfo,
  firstSeasonEditOpen,
  playerEditError,
} from './player-edit.js';
import { migrateSave } from './save.js';
import type { GameState } from './types.js';

// T-11-804 첫 시즌 선수 정보 고치기. '같은 시드에서 체격 A로 만든 뒤 B로 고친 선수'와 '처음부터 B로 만든 선수'가 같은지를
// 시드 여러 개로 확인한다(동치 하네스). 체격 선택은 게임 RNG를 쓰지 않는 따로 둔 LCG로 고른다.

const POSES: Pos[] = ['FW', 'MF', 'DF', 'GK'];

function lcg(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function randomBody(r: () => number): Body {
  const { height: H, weight: Wt } = BODY_LIMITS;
  for (;;) {
    const b = {
      h: H.min + Math.floor(r() * (H.max - H.min + 1)),
      w: Wt.min + Math.floor(r() * (Wt.max - Wt.min + 1)),
    };
    if (!bodyError(b)) return b;
  }
}

interface Setup {
  seed: number;
  pos: Pos;
  type: string;
  dpos?: (typeof SELECTABLE_DETAIL_POSITIONS)[number];
}

function setupOf(i: number, r: () => number): Setup {
  const pos = POSES[i % 4]!;
  // 타깃맨(역할이 둘인 유형)을 자주 넣는다.
  const types = TYPES[pos];
  const type = pos === 'FW' && i % 3 === 0 ? 'target' : types[Math.floor(r() * types.length)]!.id;
  const dposList = SELECTABLE_DETAIL_POSITIONS.filter((d) => DETAIL_GROUP[d] === pos);
  const dpos = r() < 0.6 ? dposList[Math.floor(r() * dposList.length)] : undefined;
  return { seed: 0x804 + i * 7919, pos, type, ...(dpos && { dpos }) };
}

function make(o: Setup, body: Body | undefined, foot: GameState['foot'] = '오른발'): GameState {
  setActiveRng(createRng(o.seed));
  const s = newGame(
    {
      name: 'EDIT',
      number: 9,
      pos: o.pos,
      dpos: o.dpos,
      body,
      foot,
      type: o.type,
      trait: TRAITS[o.seed % TRAITS.length]!.id,
      cid: '00000000-0000-4000-8000-000000000804',
    },
    o.seed,
  );
  return s;
}

/** 체격 고치기가 바꾸는 필드를 뺀 나머지(이 부분은 두 선수가 완전히 같아야 한다). */
const CHANGED = ['sub', 'attrs', 'seasonStart', 'seasonStartSub', 'peak', 'peakProfile', 'body'];
const strip = (s: GameState) =>
  Object.fromEntries(Object.entries(s).filter(([k]) => !CHANGED.includes(k)));

function maxDiff(
  a: Record<string, number | undefined>,
  b: Record<string, number | undefined>,
): number {
  let m = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
    m = Math.max(m, Math.abs((a[k] ?? 0) - (b[k] ?? 0)));
  return m;
}

/** 생성 때 체격 보정이 하한 5에 걸린 세부 능력치(원래 값을 알 수 없어 동치 비교에서 뺀다). */
function clampedKeys(s: GameState): Set<string> {
  return new Set(
    Object.entries(s.sub)
      .filter(([, v]) => v <= 5)
      .map(([k]) => k),
  );
}

function playPhases(s: GameState, n: number) {
  for (let ph = 0; ph < n && ph <= LAST_PHASE; ph++) {
    s.training = s.cond < 45 ? 'rest' : pick(ATTR_KEYS);
    const { ev } = playPhase(s);
    if (ev) resolveChoice(s, ev, ri(0, eventById(ev)!.choices.length - 1));
  }
}

describe('첫 시즌 선수 정보 고치기 (T-11-804)', () => {
  it('첫 경기 전에 체격을 고친 선수는 처음부터 그 체격으로 만든 선수와 같다 (시드 600개)', () => {
    const r = lcg(804);
    let worstSub = 0;
    let worstAttr = 0;
    let targets = 0;
    let flips = 0;
    for (let i = 0; i < 600; i++) {
      const o = setupOf(i, r);
      if (o.type === 'target') targets++;
      const A = randomBody(r);
      const B = randomBody(r);
      const edited = make(o, A);
      const role = roleChoices(edited)[0]!;
      const ovrBefore = ovrRole(edited, role);
      const rngBefore = getActiveRng().getState();
      expect(editPlayerInfo(edited, { body: B, foot: '왼발' })).toBe(true);
      // 고치기는 RNG를 쓰지 않는다.
      expect(getActiveRng().getState()).toEqual(rngBefore);
      const fresh = make(o, B, '왼발');
      const skip = new Set([...clampedKeys(make(o, A)), ...clampedKeys(fresh)]);
      const keep = (x: Record<string, number>) =>
        Object.fromEntries(Object.entries(x).filter(([k]) => !skip.has(k)));
      const ds = maxDiff(keep(edited.sub), keep(fresh.sub));
      worstSub = Math.max(
        worstSub,
        ds,
        maxDiff(keep(edited.seasonStartSub), keep(fresh.seasonStartSub)),
      );
      if (!skip.size) worstAttr = Math.max(worstAttr, maxDiff(edited.attrs, fresh.attrs));
      expect(edited.body).toEqual(fresh.body);
      expect(mainRole(edited)).toBe(mainRole(fresh));
      // 기본 역할 OVR 실수값은 고치기 전과 같다(표시 OVR이 흔들리지 않는다).
      expect(Math.abs(ovrRole(edited, role) - ovrBefore)).toBeLessThan(1e-9);
      // 처음부터 B로 만든 선수와는 W 키 0.1 반올림만큼만 다르다. 표시 OVR은 반올림 경계에서만 1 다를 수 있다.
      if (!skip.size)
        expect(Math.abs(ovrRole(edited, role) - ovrRole(fresh, role))).toBeLessThanOrEqual(0.1);
      expect(Math.abs(edited.peak - fresh.peak)).toBeLessThanOrEqual(1);
      if (edited.peak !== fresh.peak) flips++;
      expect(ovr(edited)).toBe(edited.peak);
      expect(maxDiff(edited.peakProfile!.roles, fresh.peakProfile!.roles)).toBeLessThanOrEqual(1);
      expect(maxDiff(edited.peakProfile!.attrs, fresh.peakProfile!.attrs)).toBeLessThanOrEqual(1);
      expect(edited.sub).toEqual(edited.seasonStartSub);
      expect(strip(edited)).toEqual(strip(fresh));
    }
    expect(targets).toBeGreaterThan(40);
    expect(flips).toBeLessThan(30);
    expect(worstSub).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(worstAttr).toBeLessThanOrEqual(0.15);
  });

  it('체격을 원래 값으로 되돌리면 처음 선수로 돌아온다', () => {
    const r = lcg(11);
    for (let i = 0; i < 100; i++) {
      const o = setupOf(i, r);
      const A = randomBody(r);
      const s = make(o, A);
      const orig = structuredClone(s);
      const B = randomBody(r);
      editPlayerInfo(s, { body: B });
      editPlayerInfo(s, { body: A });
      // 보정이 하한 5에 걸린 칸은 원래 값을 알 수 없어 뺀다.
      const skip = new Set([...clampedKeys(orig), ...clampedKeys(make(o, B))]);
      for (const k of Object.keys(orig.sub))
        if (!skip.has(k)) expect(Math.abs(s.sub[k]! - orig.sub[k]!)).toBeLessThan(1e-9);
      expect(s.peak).toBe(orig.peak);
    }
  });

  it('첫 경기 뒤에 체격을 고치면 그동안 오른 만큼(growth)은 그대로 두고 분포만 옮긴다', () => {
    const r = lcg(22);
    for (let i = 0; i < 80; i++) {
      const o = setupOf(i, r);
      const s = make(o, randomBody(r));
      playPhases(s, 3 + (i % 4));
      expect(firstSeasonEditOpen(s)).toBe(true);
      expect(s.season.played).toBeGreaterThan(0);
      const growth = (x: GameState) =>
        Object.fromEntries(
          Object.keys(x.sub).map((k) => [k, x.sub[k]! - (x.seasonStartSub[k] ?? 0)]),
        );
      const before = growth(s);
      const o0 = ovr(s);
      const rngBefore = getActiveRng().getState();
      editPlayerInfo(s, { body: randomBody(r) });
      expect(getActiveRng().getState()).toEqual(rngBefore);
      const after = growth(s);
      // 보정이 하한 5에 걸린 칸만 빼고, 시즌 동안 오른 양은 0.1 반올림 안에서 같다.
      const ks = Object.keys(before).filter((k) => s.sub[k]! > 5 && s.seasonStartSub[k]! > 5);
      for (const k of ks) expect(Math.abs(after[k]! - before[k]!)).toBeLessThanOrEqual(0.2 + 1e-9);
      // 기본 역할이 하나인 선수는 지금 OVR도 같다.
      if (o.type !== 'target' && !(o.dpos === 'LM' || o.dpos === 'RM'))
        expect(Math.abs(ovr(s) - o0)).toBeLessThanOrEqual(1);
    }
  });

  it('첫 시즌 결산 뒤와 은퇴 뒤에는 막힌다', () => {
    const r = lcg(33);
    const o = setupOf(1, r);
    const s = make(o, { h: 180, w: 74 });
    playPhases(s, LAST_PHASE + 1);
    expect(firstSeasonEditOpen(s)).toBe(true);
    endSeason(s);
    expect(s.career.length).toBe(1);
    expect(firstSeasonEditOpen(s)).toBe(false);
    expect(bodyEditable(s)).toBe(false);
    const snap = JSON.stringify(s);
    expect(playerEditError(s, { foot: '왼발' })).toBe('closed');
    expect(editPlayerInfo(s, { name: 'NEW', foot: '왼발', body: { h: 190, w: 80 } })).toBe(false);
    expect(JSON.stringify(s)).toBe(snap);

    const t = make(o, { h: 180, w: 74 });
    t.retired = true;
    expect(firstSeasonEditOpen(t)).toBe(false);
    expect(editPlayerInfo(t, { foot: '왼발' })).toBe(false);
    expect(t.foot).toBe('오른발');
  });

  it('이름 · 주발은 바꾸고, 잘못된 값은 아무것도 바꾸지 않는다', () => {
    const s = make(setupOf(2, lcg(44)), { h: 183, w: 77 });
    expect(editPlayerInfo(s, { name: '  손흥민  ', foot: '양발' })).toBe(true);
    expect(s.name).toBe('손흥민');
    expect(s.foot).toBe('양발');
    expect(editPlayerInfo(s, { name: '손흥민', foot: '양발', body: { h: 183, w: 77 } })).toBe(
      false,
    );
    const snap = JSON.stringify(s);
    expect(playerEditError(s, { name: '   ' })).toBe('name');
    expect(playerEditError(s, { name: 'x'.repeat(13) })).toBe('name');
    expect(playerEditError(s, { body: { h: 150, w: 60 } })).toBe('body');
    expect(playerEditError(s, { body: { h: 160, w: 100 } })).toBe('body');
    expect(playerEditError(s, { foot: '발' as GameState['foot'] })).toBe('foot');
    expect(editPlayerInfo(s, { name: '바뀜', body: { h: 150, w: 60 } })).toBe(false);
    expect(JSON.stringify(s)).toBe(snap);
  });

  it('체격 입력 전에 만든 선수는 이름 · 주발만 고친다', () => {
    const s = make(setupOf(3, lcg(55)), undefined);
    expect(bodyEditable(s)).toBe(false);
    expect(playerEditError(s, { body: { h: 180, w: 74 } })).toBe('body');
    expect(editPlayerInfo(s, { foot: '왼발' })).toBe(true);
    expect(s.body).toBeUndefined();
  });

  it('고친 세이브를 저장했다 다시 읽어도 그대로이고, 이어서 같은 커리어로 진행한다', () => {
    const o = setupOf(5, lcg(66));
    const a = make(o, { h: 170, w: 65 });
    editPlayerInfo(a, { name: '저장', foot: '왼발', body: { h: 192, w: 88 } });
    const saved = JSON.parse(JSON.stringify(a)) as GameState;
    migrateSave(saved);
    const b = saved;
    expect(b.name).toBe('저장');
    expect(b.foot).toBe('왼발');
    expect(b.body).toEqual({ h: 192, w: 88 });
    expect(b.sub).toEqual(a.sub);
    expect(b.seasonStartSub).toEqual(a.seasonStartSub);
    expect(firstSeasonEditOpen(b)).toBe(true);
    // 같은 RNG 상태에서 이어 가면 두 상태가 같은 시즌을 보낸다.
    const st = getActiveRng().getState();
    playPhases(a, LAST_PHASE + 1);
    getActiveRng().setState(st);
    playPhases(b, LAST_PHASE + 1);
    expect(b.season).toEqual(a.season);
  });
});
