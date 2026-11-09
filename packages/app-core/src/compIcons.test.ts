import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { setCustomNames, withDefaultNames } from '@offside/game/i18n/names';
import { LEAGUE_BASE } from '@offside/contracts/club-names';
import {
  COMP_ICON_HINT_KEY,
  COMP_ICON_IMG_MAX,
  COMP_ICONS_KEY,
  COMP_ICONS_NO_SPACE,
  COMP_ICONS_TOTAL_MAX,
  createCompIcons,
  initialCompIconsState,
  sanitizeCompIcons,
} from './compIcons.js';
import { compEmblem, compKindOf, compOfTrophy, hasCompEmblem, markOf } from './compEmblem.js';
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

const IMG = `data:image/webp;base64,${'A'.repeat(200)}`;

describe('리그·대회 로고 바꾸기 저장 (T-11-679)', () => {
  it('고른 이미지를 이 기기에 저장하고 다시 읽는다', () => {
    const state = initialCompIconsState();
    const c = createCompIcons(state);
    expect(c.setCompIcon('코리아컵', IMG)).toBe(true);
    expect(state.map).toEqual({ 코리아컵: IMG });
    expect(JSON.parse(mem.get(COMP_ICONS_KEY)!)).toEqual({ v: 1, icons: { 코리아컵: IMG } });
    const again = initialCompIconsState();
    createCompIcons(again).loadCompIcons();
    expect(again.map).toEqual({ 코리아컵: IMG });
  });

  it('null이면 기본 로고로 돌리고, 없는 로고를 돌려도 저장하지 않는다', () => {
    const state = initialCompIconsState();
    const c = createCompIcons(state);
    expect(c.setCompIcon('FA컵', null)).toBe(true);
    expect(mem.has(COMP_ICONS_KEY)).toBe(false);
    c.setCompIcon('FA컵', IMG);
    expect(c.setCompIcon('FA컵', null)).toBe(true);
    expect(state.map).toEqual({});
  });

  it('이미지가 아니거나 너무 크면 big, 합계를 넘으면 full, 저장소가 차면 space', () => {
    const state = initialCompIconsState();
    const c = createCompIcons(state);
    expect(c.setCompIcon('FA컵', 'javascript:alert(1)')).toBe('big');
    expect(c.setCompIcon('FA컵', `data:image/svg+xml;base64,AAAA`)).toBe('big');
    expect(c.setCompIcon('FA컵', `data:image/png;base64,${'A'.repeat(COMP_ICON_IMG_MAX)}`)).toBe(
      'big',
    );
    const big = `data:image/png;base64,${'A'.repeat(COMP_ICON_IMG_MAX - 40)}`;
    let r: ReturnType<typeof c.setCompIcon> = true;
    for (let i = 0; i < 80 && r === true; i++) r = c.setCompIcon(`대회 ${i}`, big);
    expect(r).toBe('full');
    expect(Object.values(state.map).join('').length).toBeLessThanOrEqual(COMP_ICONS_TOTAL_MAX);
    full = true;
    expect(c.setCompIcon('FA컵', IMG)).toBe('space');
    expect(state.map.FA컵).toBeUndefined();
  });

  it('저장소 · 파일에서 읽은 값은 이미지 data URL만 남긴다', () => {
    expect(sanitizeCompIcons({ a: IMG, b: 3, c: 'http://x', '': IMG })).toEqual({ a: IMG });
    expect(sanitizeCompIcons([IMG])).toEqual({});
    expect(sanitizeCompIcons(null)).toEqual({});
  });

  it('에디트 파일: icons가 있으면 통째로 바꾸고, 없으면 그대로 둔다', () => {
    const state = initialCompIconsState();
    const c = createCompIcons(state);
    c.setCompIcon('FA컵', IMG);
    expect(c.importCompIcons({ v: 1, names: {} })).toBe(0);
    expect(state.map).toEqual({ FA컵: IMG });
    expect(c.importCompIcons({ v: 1, names: {}, icons: { 코리아컵: IMG, bad: 1 } })).toBe(1);
    expect(state.map).toEqual({ 코리아컵: IMG });
    full = true;
    expect(c.importCompIcons({ icons: { FA컵: IMG } })).toBe(COMP_ICONS_NO_SPACE);
    expect(c.exportCompIcons()).toEqual({ 코리아컵: IMG });
  });

  it('안내는 한 번 닫으면 다시 뜨지 않는다', () => {
    const state = initialCompIconsState();
    const c = createCompIcons(state);
    c.loadCompIcons();
    expect(state.hinted).toBe(false);
    c.dismissCompIconHint();
    expect(mem.get(COMP_ICON_HINT_KEY)).toBe('1');
    const again = initialCompIconsState();
    createCompIcons(again).loadCompIcons();
    expect(again.hinted).toBe(true);
  });
});

describe('리그·대회 기본 로고 (T-11-679)', () => {
  it('모든 리그와 바꿀 수 있는 대회에 로고가 있고, 약칭이 비지 않는다', () => {
    const comps = customNameCatalog(null).comp.map((x) => x.ko);
    for (const ko of [...LEAGUE_BASE.map((l) => l.name), ...comps]) {
      expect(hasCompEmblem(ko), ko).toBe(true);
      expect(compEmblem(ko).mark.text, ko).toMatch(/^[A-Z0-9]{1,5}$/);
    }
    expect(comps).toHaveLength(47);
  });

  it('종류마다 틀이 다르다', () => {
    expect(compKindOf('프리미어리그')).toBe('league');
    expect(compKindOf('FA컵')).toBe('cup');
    expect(compKindOf('FA 커뮤니티 실드')).toBe('super');
    expect(compKindOf('UEFA 챔피언스리그')).toBe('club');
    expect(compKindOf('FIFA 클럽 월드컵')).toBe('club');
    expect(compKindOf('FIFA 월드컵')).toBe('national');
    expect(compKindOf('발롱도르')).toBeNull();
    expect(compEmblem('UEFA 챔피언스리그').mark.text).toBe('UCL');
    expect(compEmblem('프리미어리그').mark.text).toBe('PL');
  });

  it('트로피 이름에서 대회를 찾는다', () => {
    expect(compOfTrophy('프리미어리그 우승')).toBe('프리미어리그');
    expect(compOfTrophy('AFC 챔피언스리그 엘리트 우승')).toBe('AFC 챔피언스리그 엘리트');
    expect(compOfTrophy('FIFA 월드컵 우승')).toBe('FIFA 월드컵');
    expect(compOfTrophy('올림픽 은메달')).toBeNull();
    expect(compOfTrophy('없는 대회 우승')).toBeNull();
  });

  it('이름을 바꾸면 약칭을 바꾼 이름에서 따고, 원래 이름으로 그릴 때는 기본 약칭', () => {
    setCustomNames({ 'UEFA 챔피언스리그': 'Super Euro Cup', 코리아컵: '오프사이드컵' });
    expect(compEmblem('UEFA 챔피언스리그').mark.text).toBe('SEC');
    expect(compEmblem('코리아컵').mark.text).toBe('오프');
    expect(withDefaultNames(() => compEmblem('UEFA 챔피언스리그').mark.text)).toBe('UCL');
  });

  it('약칭 따기', () => {
    expect(markOf('Champions League')).toBe('CL');
    expect(markOf('Liga 2')).toBe('L2');
    expect(markOf('KLEAGUE')).toBe('KLEA');
    expect(markOf('챔스')).toBe('챔스');
    expect(markOf('  ')).toBe('');
  });
});
