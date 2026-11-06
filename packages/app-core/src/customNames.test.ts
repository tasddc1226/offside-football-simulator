import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { setCustomNames, tn } from '@offside/game/i18n/names';
import type { GameState } from '@offside/game/types';
import {
  CUSTOM_NAME_MAX,
  CUSTOM_NAMES_KEY,
  CUSTOM_NAMES_NO_SPACE,
  createCustomNames,
  initialCustomNamesState,
  sanitizeCustomNames,
} from './customNames.js';
import { customNameCatalog } from './customNamesCatalog.js';

let mem: Map<string, string>;
let full = false;
beforeEach(() => {
  mem = new Map();
  full = false;
  setStorage({
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      if (full) throw new Error('quota');
      mem.set(k, v);
    },
  });
});
afterEach(() => setCustomNames({}));

describe('대회·수상 이름 바꾸기 (T-11-647)', () => {
  it('바꾼 이름을 이 기기에 저장하고 화면 이름(tn)에 바로 건다', () => {
    const state = initialCustomNamesState();
    const n = createCustomNames(state);
    expect(n.setCustomName('코리아컵', '  오프사이드컵 ')).toBe(true);
    expect(state.map).toEqual({ 코리아컵: '오프사이드컵' });
    expect(tn('코리아컵 우승')).toBe('오프사이드컵 우승');
    expect(JSON.parse(mem.get(CUSTOM_NAMES_KEY)!)).toEqual({
      v: 1,
      names: { 코리아컵: '오프사이드컵' },
    });
    // 빈 값·원래와 같은 값은 원래대로.
    n.setCustomName('코리아컵', '');
    expect(state.map).toEqual({});
    expect(tn('코리아컵')).toBe('코리아컵');
  });

  it('다시 켜면 저장된 이름표를 읽어 건다', () => {
    mem.set(CUSTOM_NAMES_KEY, JSON.stringify({ v: 1, names: { FA컵: '잉글랜드컵' } }));
    const state = initialCustomNamesState();
    createCustomNames(state).loadCustomNames();
    expect(state.map).toEqual({ FA컵: '잉글랜드컵' });
    expect(tn('FA컵 우승')).toBe('잉글랜드컵 우승');
  });

  it('에디트 파일로 내보내고 가져온다(틀린 형식 -1, 저장 공간 부족 구분)', () => {
    const a = createCustomNames(initialCustomNamesState());
    a.setCustomName('K리그1', '1부');
    a.setCustomName('득점왕', '골든부트');
    const file = a.exportCustomNames();
    a.resetCustomNames();
    const state = initialCustomNamesState();
    const b = createCustomNames(state);
    expect(b.importCustomNames(file)).toBe(2);
    expect(state.map).toEqual({ K리그1: '1부', 득점왕: '골든부트' });
    expect(b.importCustomNames('not json')).toBe(-1);
    expect(b.importCustomNames('{"clubs":{}}')).toBe(-1);
    full = true;
    expect(b.importCustomNames(file)).toBe(CUSTOM_NAMES_NO_SPACE);
    expect(b.setCustomName('FA컵', 'X')).toBe(false);
  });

  it('고른 이름만 되돌린다', () => {
    const state = initialCustomNamesState();
    const n = createCustomNames(state);
    n.setCustomName('A', '1');
    n.setCustomName('B', '2');
    n.resetCustomNames(['A']);
    expect(state.map).toEqual({ B: '2' });
  });

  it('파일 값을 정리한다: 문자열만, 길이 제한, 제어 문자 제거', () => {
    expect(sanitizeCustomNames({ a: 'x'.repeat(50), b: 3, c: ' ', d: 'd', e: '줄\n바꿈' })).toEqual(
      { a: 'x'.repeat(CUSTOM_NAME_MAX), e: '줄바꿈' },
    );
    expect(sanitizeCustomNames([1, 2])).toEqual({});
  });

  it('목록은 내 커리어에 나온 이름을 먼저, 우승 트로피는 대회 이름으로 싣는다', () => {
    const G = {
      career: [
        { league: 'K리그1', comps: [{ name: '코리아컵' }, { name: 'AFC 챔피언스리그 엘리트' }] },
      ],
      trophies: [{ year: 2030, t: 'J1리그 우승', club: 'X' }],
      awards: [{ year: 2030, t: 'K리그1 득점왕' }],
    } as unknown as GameState;
    const c = customNameCatalog(G);
    expect(c.comp.slice(0, 3).map((x) => x.ko)).toEqual([
      '코리아컵',
      'AFC 챔피언스리그 엘리트',
      'J1리그',
    ]);
    expect(c.comp[0]!.mine).toBe(true);
    expect(c.comp.some((x) => x.ko === 'FA컵' && !x.mine)).toBe(true);
    expect(c.award[0]).toEqual({ ko: 'K리그1 득점왕', mine: true });
    expect(c.league[0]).toEqual({ ko: 'K리그1', mine: true });
    // 같은 이름은 한 번.
    expect(c.league.filter((x) => x.ko === 'K리그1')).toHaveLength(1);
    expect(customNameCatalog(null).comp.every((x) => !x.mine)).toBe(true);
  });
});
