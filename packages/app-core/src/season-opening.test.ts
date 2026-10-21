import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { generateCandidates } from '@offside/game/candidates';
import { gradeOf } from '@offside/game/stats';
import '@offside/game/premiumScout';
import { ovr } from '@offside/game/attributes';
import { startOvr } from './create-view.js';
import { setLatestBalance } from '@offside/game/balance';
import { createRng, setActiveRng } from '@offside/game/rng';
import { loadSave } from '@offside/game/save';
import { retireAge } from '@offside/game/season';
import { createGameActions, type GameHost } from './game-actions.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import { watchDetailOpening, watchSeasonClock, watchSeasonNow } from './season-opening.js';
import { draftCareerRules, initialAppState } from './state.js';
import { DETAILS_OF, DPOS, typeForFocus } from '@offside/game/data';

const BEFORE = '2026-10-05T14:59:59.999Z';
const OPEN = '2026-10-05T15:00:00.000Z';

function harness() {
  const state = initialAppState();
  const host: GameHost = {
    state,
    sheet: createSheetController(initialSheetState(), {
      tick: async () => {},
      painted: async () => {},
      motionOK: () => false,
    }),
    save: vi.fn(),
    toast: vi.fn(),
    scrollTop: vi.fn(),
    uploadSeason: vi.fn(),
    uploadRetirement: vi.fn(),
    trackPage: vi.fn(),
    analytics: {
      replace: vi.fn(),
      start: vi.fn(),
      play: vi.fn(),
      firstSeason: vi.fn(),
      retire: vi.fn(),
    },
  };
  return { state, host, actions: createGameActions(host) };
}

beforeEach(() => {
  const mem = new Map<string, string>();
  setStorage({
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(BEFORE));
  setLatestBalance(null);
  setActiveRng(createRng(61006));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  setLatestBalance(null);
});

describe('시즌 1 개막 · 웹/앱 공용 생성 경계', () => {
  it('개막 직전 생성한 선수는 개막 뒤 복원해도 프리시즌 규칙을 유지한다', () => {
    const h = harness();
    h.state.C.dpos = 'W'; // 전에 고른 값도 프리시즌에는 적용하지 않는다.
    h.actions.startCareer('T', 9);
    const before = h.state.G!;
    expect(before.dpos).toBeUndefined();
    expect(retireAge(before)).toBe(41);
    const saved = JSON.stringify(before);
    vi.setSystemTime(new Date(OPEN));
    const restored = loadSave(JSON.parse(saved))!.G;
    expect(restored.dpos).toBeUndefined();
    expect(retireAge(restored)).toBe(41);
    expect(restored.attrs).toEqual(before.attrs);
    expect(restored.pot).toBe(before.pot);
    expect(restored.rng).toEqual(before.rng);
  });

  it('개막 시각부터 선택한 세부 포지션과 45세 규칙이 함께 저장·복원된다', () => {
    vi.setSystemTime(new Date(OPEN));
    const h = harness();
    h.state.C.pos = 'MF';
    h.state.C.dpos = 'CM';
    h.actions.startCareer('T', 9);
    expect(h.state.G).toMatchObject({ pos: 'MF', dpos: 'CM', retireAt: 45 });
    const restored = loadSave(JSON.parse(JSON.stringify(h.state.G)))!.G;
    expect(restored).toMatchObject({ pos: 'MF', dpos: 'CM', retireAt: 45 });
  });

  it('프리시즌 후보를 고른 채 자정을 넘어도 세부 포지션 없는 시즌 1 선수를 만들지 않는다', () => {
    const h = harness();
    h.actions.rollCandidates();
    const picked = h.state.candidates![0]!;
    const attrs = { ...picked.attrs };
    const focus = [...h.state.C.focus];
    vi.setSystemTime(new Date(OPEN));
    h.actions.startCareer('T', 9, picked.attrs);
    expect(h.state.G).toMatchObject({ dpos: 'ST', retireAt: 45, focus });
    expect(picked.attrs).toEqual(attrs);
    expect(Math.abs(ovr(h.state.G!) - startOvr(h.state.C.pos, attrs))).toBeLessThanOrEqual(1);
    expect(h.host.save).toHaveBeenCalledOnce();
  });
});

describe('개막 선택지 알림', () => {
  it('경계에서 한 번만 알리고 취소한 화면은 갱신하지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BEFORE));
    const opened = vi.fn();
    const closed = vi.fn();
    const stop = watchDetailOpening(closed);
    watchDetailOpening(opened);
    stop();
    expect(opened).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(opened).toHaveBeenCalledOnce();
    expect(closed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(opened).toHaveBeenCalledOnce();
  });

  it('T-11-107 시즌 시계: 개막 1초 뒤 한 번 알리고, 다음 개막이 없으면 타이머를 남기지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BEFORE));
    const tick = vi.fn();
    const stop = watchSeasonClock(tick);
    vi.advanceTimersByTime(1000);
    expect(tick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(tick).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it('T-11-110 시즌 시각: 새 시즌이 열렸을 때만 알리고, 그 뒤 화면 복귀로는 다시 알리지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BEFORE));
    const changed = vi.fn();
    const stop = watchSeasonNow(BEFORE, changed);
    vi.advanceTimersByTime(1001);
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]![0] >= OPEN).toBe(true);
    stop();
    // 이미 개막한 뒤 띄운 화면은 알릴 일이 없다.
    const again = vi.fn();
    watchSeasonNow(new Date().toISOString(), again)();
    expect(again).not.toHaveBeenCalled();
  });

  it('개막 뒤에는 즉시 알리고 타이머를 남기지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(OPEN));
    const opened = vi.fn();
    watchDetailOpening(opened)();
    expect(opened).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('타이머 상한보다 먼 개막도 즉시 반복하지 않고 경계까지 기다린다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(OPEN) - 2_147_483_650));
    const opened = vi.fn();
    const stop = watchDetailOpening(opened);
    vi.advanceTimersByTime(2_147_483_647);
    expect(opened).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3);
    expect(opened).toHaveBeenCalledOnce();
    stop();
  });

  it('각 큰 포지션의 기본값을 쓰되 유효한 선택과 프리시즌 규칙은 지킨다', () => {
    for (const [pos, dpos] of [
      ['FW', 'ST'],
      ['MF', 'AM'],
      ['DF', 'CB'],
      ['GK', 'GK'],
    ] as const) {
      expect(draftCareerRules({ pos, dpos: null }, OPEN)).toEqual({ dpos, retireAt: 45 });
      expect(draftCareerRules({ pos, dpos: 'W' }, BEFORE)).toEqual({
        dpos: undefined,
        retireAt: 41,
      });
    }
    expect(draftCareerRules({ pos: 'FW', dpos: 'W' }, OPEN).dpos).toBe('W');
    expect(draftCareerRules({ pos: 'DF', dpos: 'W' }, OPEN).dpos).toBe('CB');
  });
});

describe('candidate reveal and retirement minimum', () => {
  it('persists a reveal for the same scout pool and keeps selected potential at kickoff', () => {
    vi.setSystemTime(new Date(OPEN));
    const { state, actions } = harness();
    actions.rollCandidates();
    const batch = state.candidates!;
    expect(state.candidatePotentialOpen).toBe(false);
    expect(actions.revealCandidatePotential(batch)).toBe(true);
    actions.rollCandidates();
    expect(state.candidatePotentialOpen).toBe(true);
    expect(state.candidates![0]!.potential).toEqual(batch[0]!.potential);
    expect(actions.revealCandidatePotential(batch)).toBe(false);
    const c = state.candidates![2]!;
    actions.startCareer('test', 7, c.attrs, c.potential);
    expect(state.G!.pot + state.G!.bloom).toBe(c.potential.value);
  });
  it('T-11-225 keeps one candidate in place across rerolls and other careers, dropping it once started', () => {
    vi.setSystemTime(new Date(OPEN));
    const { state, actions } = harness();
    actions.rollCandidates();
    const kept = state.candidates![1]!;
    const keptPos = state.C.pos;
    actions.keepCandidate(1);
    actions.keepCandidate(2); // 한 명만 — 2번을 킵하면 1번은 풀린다.
    expect(state.candidates!.map((c) => !!c.kept)).toEqual([false, false, true]);
    actions.keepCandidate(1);
    actions.rerollCandidates();
    expect(state.candidates![1]!.attrs).toEqual(kept.attrs);
    expect(state.candidates![1]!.kept).toEqual({ revealed: false });
    expect(state.candidatesOpen[1]).toBe(true);
    // 0번은 기준 분포라 킵한 후보와 능력치가 우연히 같을 수 있다 — 킵 표시가 그 자리에만 있는지로 본다.
    expect(state.candidates!.map((c) => !!c.kept)).toEqual([false, true, false]);
    // 킵한 뒤 잠재력을 열면 다음 다시 뽑기에서도 그 후보의 범위는 보인다.
    actions.revealCandidatePotential();
    actions.rerollCandidates();
    expect(state.candidatePotentialOpen).toBe(false);
    expect(state.candidates![1]!.kept).toEqual({ revealed: true });
    // 다른 포지션으로 뽑으면 넣지 않는다.
    state.C.pos = state.C.pos === 'FW' ? 'DF' : 'FW';
    actions.rollCandidates();
    expect(state.candidates!.some((c) => c.kept)).toBe(false);
    // T-11-234 다른 후보로 커리어를 시작해도 킵은 남아 다음 커리어 후보에 다시 들어간다.
    const other = state.candidates![0]!;
    actions.startCareer('test', 7, other.attrs, other.potential);
    state.C.pos = keptPos;
    actions.rollCandidates();
    expect(state.candidates![1]!.attrs).toEqual(kept.attrs);
    // 킵한 후보로 시작하면 풀린다.
    const mine = state.candidates![1]!;
    actions.startCareer('test', 7, mine.attrs, mine.potential);
    actions.rollCandidates();
    expect(state.candidates!.some((c) => c.kept)).toBe(false);
  });
  it('T-11-294 kept candidate survives an app reopen and a different focus order', () => {
    vi.setSystemTime(new Date(OPEN));
    const a = harness();
    const d = DETAILS_OF.DF[1]!;
    Object.assign(a.state.C, { pos: 'DF', dpos: d, focus: [...DPOS[d].focus] });
    a.actions.rollCandidates();
    a.actions.keepCandidate(0);
    const kept = a.state.candidates![0]!;
    // 다음 날 앱을 새로 연다: 입력은 기본값(FW)이라 킵 후보가 나오지 않고, 그 조건을 알려 준다.
    const b = harness();
    b.actions.rollCandidates();
    expect(b.state.candidates!.some((c) => c.kept)).toBe(false);
    expect(b.actions.keptDraft()).toEqual({ pos: 'DF', dpos: d, focus: [...DPOS[d].focus] });
    // 맞추기 버튼은 입력 화면(후보를 닫은 뒤)에 있다.
    b.state.candidates = null;
    expect(b.actions.restoreKeptDraft()).toBe(true);
    expect(b.actions.keptDraft()).toBeNull();
    b.actions.rollCandidates();
    expect(b.state.candidates![0]!.attrs).toEqual(kept.attrs);
    // 같은 주력을 다른 순서로 골라도 같은 조합이다.
    b.state.C.focus = [...DPOS[d].focus].reverse();
    b.actions.rollCandidates();
    expect(b.state.candidates![0]!.attrs).toEqual(kept.attrs);
    expect(b.actions.restoreKeptDraft()).toBe(false);
  });
  it('T-11-327 후보가 떠 있으면 킵 조건으로 되돌리지 않고, 후보로 시작하면 뽑은 입력의 플레이스타일이다', () => {
    vi.setSystemTime(new Date(OPEN));
    // 센터백 스토퍼 후보를 킵해 둔다.
    const a = harness();
    Object.assign(a.state.C, { pos: 'DF', dpos: 'CB', focus: ['def', 'phy'] });
    a.actions.rollCandidates();
    a.actions.keepCandidate(0);
    // 앱을 다시 열면 처음 한 번은 킵 조건으로 맞춘다.
    const b = harness();
    expect(b.actions.restoreKeptDraft({ auto: true })).toBe(true);
    expect(b.state.C.dpos).toBe('CB');
    // 왼쪽 풀백 · 공격형 풀백으로 바꿔 후보를 띄운다.
    Object.assign(b.state.C, { dpos: 'LB', focus: ['pac', 'pas'] });
    b.actions.rollCandidates();
    // 화면에 다시 들어와도(자동) · 버튼으로도 후보가 떠 있는 동안은 입력을 바꾸지 않는다.
    expect(b.actions.restoreKeptDraft({ auto: true })).toBe(false);
    expect(b.actions.restoreKeptDraft()).toBe(false);
    expect(b.state.C).toMatchObject({ dpos: 'LB', focus: ['pac', 'pas'] });
    // 다른 길로 입력이 바뀌어도 후보로 시작하면 그 후보를 뽑은 입력으로 만든다.
    b.state.C.focus = ['def', 'phy'];
    b.state.C.dpos = 'CB';
    b.actions.startCareer('T', 3, b.state.candidates![1]!.attrs);
    expect(b.state.G).toMatchObject({ dpos: 'LB', type: typeForFocus('DF', ['pac', 'pas']) });
    // 자동 맞추기는 앱을 연 뒤 한 번뿐이다.
    expect(b.actions.restoreKeptDraft({ auto: true })).toBe(false);
  });
  it('T-11-244 천장 S 여부(hit)는 킵한 후보가 덮을 자리를 세지 않는다', () => {
    const { state, actions } = harness();
    // 보장 후보가 아닌 자리 하나에만 S가 있는 시드를 찾는다.
    const dpos = draftCareerRules(state.C).dpos;
    let seed = 1;
    let sIdx = -1;
    for (; seed < 100_000 && sIdx < 0; seed++) {
      const b = generateCandidates(state.C.pos, state.C.focus, dpos, seed, 3, true);
      const s = b.map((c) => gradeOf(c.potential.value) === 'S');
      if (s.filter(Boolean).length === 1 && !b[s.indexOf(true)]!.guaranteed) sIdx = s.indexOf(true);
    }
    seed--;
    expect(sIdx).toBeGreaterThanOrEqual(0);
    const random = vi.spyOn(Math, 'random').mockReturnValue((seed + 0.5) / 0xffffffff);
    expect(actions.planPremiumScout()).toEqual({ seed, hit: true });
    // 앞서 다른 시드로 뽑은 S 아닌 후보를 그 자리에 킵한다.
    let other = seed + 1;
    do {
      random.mockReturnValue((other++ + 0.5) / 0xffffffff);
      actions.rerollCandidates();
    } while (gradeOf(state.candidates![sIdx]!.potential.value) === 'S');
    actions.keepCandidate(sIdx);
    random.mockReturnValue((seed + 0.5) / 0xffffffff);
    // S가 나올 자리를 킵한 후보가 덮으면 유저는 S를 못 보니 hit도 아니다.
    expect(actions.planPremiumScout()).toEqual({ seed, hit: false });
    actions.premiumScoutCandidates(seed, 'normal');
    expect(state.candidates!.some((c) => gradeOf(c.potential.value) === 'S')).toBe(false);
    expect(state.candidates![sIdx]!.kept).toBeTruthy();
    // 다른 자리를 킵하면 S는 그대로 보이므로 hit다.
    actions.keepCandidate([0, 1, 2].find((i) => i !== sIdx && !state.candidates![i]!.guaranteed)!);
    expect(actions.planPremiumScout()).toEqual({ seed, hit: true });
    actions.premiumScoutCandidates(seed, 'normal');
    expect(gradeOf(state.candidates![sIdx]!.potential.value)).toBe('S');
  });
  it('does not grant a reveal when saving fails', () => {
    const { state, actions } = harness();
    actions.rollCandidates();
    setStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(actions.revealCandidatePotential()).toBe(false);
    expect(state.candidatePotentialOpen).toBe(false);
  });
  it('recovers an old offerless market save below 25', () => {
    const { state, host, actions } = harness();
    actions.startCareer('test', 7);
    state.G!.age = 24;
    state.G!.pending = {
      type: 'market',
      res: null,
      m: { options: [], note: 'old forced retirement', canRetire: true },
    };
    actions.nextPending();
    expect(state.G!.pending.m!.options.length).toBeGreaterThan(0);
    expect(state.G!.pending.m!.canRetire).toBe(false);
    expect(host.save).toHaveBeenCalled();
  });
  it('blocks both direct retirement and its confirmation below 25', () => {
    const { state, host, actions } = harness();
    actions.startCareer('test', 7);
    state.G!.age = 24;
    actions.doRetire();
    actions.retireAsk();
    expect(state.G!.retired).toBe(false);
    expect(host.uploadRetirement).not.toHaveBeenCalled();
    expect(host.toast).toHaveBeenCalled();
    state.G!.age = 25;
    actions.doRetire();
    expect(state.G!.retired).toBe(true);
  });
});
