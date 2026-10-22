import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadKey, saveKey, setStorage } from '@offside/game/storage';
import { setLatestBalance } from '@offside/game/balance';
import { createRng, setActiveRng } from '@offside/game/rng';
import { createGameActions, type GameHost } from './game-actions.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import {
  DRAFT_IDENTITY_KEY,
  draftIdentity,
  initialAppState,
  randomName,
  randomNumber,
  savedDraftIdentity,
} from './state.js';

let mem: Map<string, string>;

function harness() {
  const state = initialAppState();
  const sheet = createSheetController(initialSheetState(), {
    tick: async () => {},
    painted: async () => {},
    motionOK: () => false,
  });
  const host: GameHost = {
    state,
    sheet,
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
  return { state, sheet, host, actions: createGameActions(host) };
}

/** 같은 시드로 무작위 이름·등번호를 뽑았을 때의 값. */
function randomAt(seed: number) {
  setActiveRng(createRng(seed));
  return { name: randomName(), number: randomNumber() };
}

beforeEach(() => {
  mem = new Map();
  setStorage({
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
  });
  setLatestBalance(null);
  setActiveRng(createRng(61006));
});

describe('선수 만들기 이름·등번호 이어 쓰기', () => {
  it('커리어를 시작하면 고른 이름·등번호를 저장하고, 은퇴 전 재시작에서 처음 값으로 채운다', () => {
    const { state, sheet, actions } = harness();
    actions.startCareer('  손흥민 ', 7);
    expect(loadKey(DRAFT_IDENTITY_KEY)).toEqual({ name: '손흥민', number: 7 });
    state.C.name = '다른 이름';
    state.C.number = 30;
    actions.confirmNew();
    sheet.state.buttons[0]!.fn();
    // T-11-431 진행 중인 커리어는 새 선수로 킥오프할 때까지 남는다.
    expect(state.G?.name).toBe('손흥민');
    expect(state.screen).toBe('create');
    expect(state.C).toMatchObject({ name: '손흥민', number: 7 });
    // 앱을 다시 열어도 같다.
    expect(initialAppState().C).toMatchObject({ name: '손흥민', number: 7 });
  });

  it('T-11-431 새 커리어를 확인해도 킥오프 전에는 세이브를 지우지 않고, 킥오프하면 그때 바꾼다', () => {
    const { state, sheet, host, actions } = harness();
    actions.startCareer('이어할선수', 10);
    const old = state.G!;
    const saves = vi.mocked(host.save).mock.calls.length;
    actions.confirmNew();
    sheet.state.buttons[0]!.fn();
    expect(state.screen).toBe('create');
    expect(state.G).toBe(old);
    expect(host.save).toHaveBeenCalledTimes(saves);
    expect(host.analytics.replace).not.toHaveBeenCalled();
    // 만들기 화면을 나가면(취소) 그대로 이어할 수 있다.
    state.screen = 'home';
    expect(state.G).toBe(old);
    // 다시 들어와 킥오프하면 그때 새 커리어로 바꾸고 저장한다.
    actions.confirmNew();
    sheet.state.buttons[0]!.fn();
    actions.startCareer('새선수', 11);
    expect(state.G!.name).toBe('새선수');
    expect(state.G!.cid).not.toBe(old.cid);
    expect(host.save).toHaveBeenCalledTimes(saves + 1);
    expect(host.analytics.replace).toHaveBeenCalledTimes(1);
    expect(host.analytics.start).toHaveBeenLastCalledWith(state.G, old);
  });

  it('빈 이름·0번으로 시작하면 실제로 쓴 무작위 값을 저장한다', () => {
    const { state, actions } = harness();
    actions.startCareer('', 0);
    expect(loadKey(DRAFT_IDENTITY_KEY)).toEqual({ name: state.G!.name, number: state.G!.number });
  });

  it('은퇴하면 저장값을 지우고 다음 선수 만들기는 무작위 값으로 시작한다', () => {
    const { state, actions } = harness();
    actions.startCareer('테스트선수', 7);
    state.G!.age = 30;
    setActiveRng(createRng(7));
    actions.doRetire();
    expect(state.G!.retired).toBe(true);
    expect(savedDraftIdentity()).toBeNull();
    expect(state.C.name).not.toBe('테스트선수');
    expect(state.C.number).toBeGreaterThanOrEqual(1);
    expect(state.C.number).toBeLessThanOrEqual(99);
    setActiveRng(createRng(9));
    expect(initialAppState().C).toMatchObject(randomAt(9));
  });

  it('무작위 버튼·직접 입력으로 고친 값이 다음 저장값이 된다', () => {
    const { state, actions } = harness();
    actions.startCareer('손흥민', 7);
    actions.startCareer('새 이름', 23);
    expect(savedDraftIdentity()).toEqual({ name: '새 이름', number: 23 });
    expect(state.G!.name).toBe('새 이름');
  });

  it.each([
    ['값 없음', undefined],
    ['깨진 JSON', '{"name":"손'],
    ['null', 'null'],
    ['문자열', '"손흥민"'],
    ['빈 이름', JSON.stringify({ name: '', number: 7 })],
    ['공백 이름', JSON.stringify({ name: '  ', number: 7 })],
    ['이름 없음', JSON.stringify({ number: 7 })],
    ['등번호 0', JSON.stringify({ name: '손흥민', number: 0 })],
    ['등번호 100', JSON.stringify({ name: '손흥민', number: 100 })],
    ['등번호 소수', JSON.stringify({ name: '손흥민', number: 7.5 })],
    ['등번호 문자열', JSON.stringify({ name: '손흥민', number: '7' })],
  ])('%s이면 무작위 값으로 대체한다', (_, raw) => {
    if (raw !== undefined) mem.set(DRAFT_IDENTITY_KEY, raw);
    expect(savedDraftIdentity()).toBeNull();
    const expected = randomAt(3);
    setActiveRng(createRng(3));
    expect(draftIdentity()).toEqual(expected);
  });

  it('경계값 1번·99번은 그대로 쓰고 난수를 쓰지 않는다', () => {
    for (const number of [1, 99]) {
      saveKey(DRAFT_IDENTITY_KEY, { name: '손흥민', number });
      setActiveRng(createRng(5));
      expect(draftIdentity()).toEqual({ name: '손흥민', number });
      const next = randomName();
      setActiveRng(createRng(5));
      expect(randomName()).toBe(next);
    }
  });
});
