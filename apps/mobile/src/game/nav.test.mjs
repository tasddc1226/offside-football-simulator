// 후보 화면의 상점 연결 — 스카우트권이 0장일 때 '프리미엄 스카우트권 보기'는 상점의 스카우트권 칸을, 리롤권이 0장일 때
// '리롤권 상점 가기'는 리롤권 칸을 펼친 채로 연다. 화면 렌더는 하지 않는다: nav의 focus 동작은 직접 부르고, 버튼 · 상점의
// 연결은 소스에서 확인한다.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ appState: { screen: 'create', honorsVisit: null, G: null } }));
vi.mock('../store', () => ({ appState: s.appState }));
vi.mock('../ui/scroll', () => ({ scrollTo: vi.fn() }));
vi.mock('./host', () => ({
  closeSheet: vi.fn(),
  confirmNew: vi.fn(),
  navStack: { back: () => false },
  nextPending: vi.fn(),
}));
vi.mock('@offside/app-core/state', () => ({ hofStart: () => ({}) }));

import * as nav from './nav';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
/** testID가 붙은 Btn 여는 태그의 onPress 이름. */
function onPressOf(code, testID) {
  const m = code.match(new RegExp(`<Btn[^>]*testID="${testID}"[^>]*onPress=\\{(\\w+)\\}`));
  return m?.[1];
}

describe('상점 focus', () => {
  beforeEach(() => {
    s.appState.screen = 'create';
    nav.takeFocus('rerollShop');
    nav.takeFocus('scoutShop');
  });

  it('goScoutShop은 상점을 열고 스카우트권 칸만 한 번 펼치게 한다', () => {
    expect(typeof nav.goScoutShop).toBe('function');
    nav.goScoutShop();
    expect(s.appState.screen).toBe('shop');
    expect(nav.takeFocus('rerollShop')).toBe(false);
    expect(nav.takeFocus('scoutShop')).toBe(true);
    expect(nav.takeFocus('scoutShop')).toBe(false);
  });

  it('goRerollShop은 그대로 리롤권 칸을 펼친다', () => {
    nav.goRerollShop();
    expect(s.appState.screen).toBe('shop');
    expect(nav.takeFocus('scoutShop')).toBe(false);
    expect(nav.takeFocus('rerollShop')).toBe(true);
  });
});

describe('후보 화면 → 상점 연결', () => {
  const create = src('../screens/create/Create.tsx');
  const shop = src('../screens/owner/Shop.tsx');
  const scoutShop = src('../screens/owner/ScoutShop.tsx');

  it('스카우트권 0장 안내 버튼은 스카우트권 상점으로 간다', () => {
    expect(onPressOf(create, 'premium-scout-go')).toBe('goScoutShop');
  });

  it('리롤권 0장 안내 버튼은 리롤권 상점으로 간다', () => {
    expect(onPressOf(create, 'reroll-shop-go')).toBe('goRerollShop');
  });

  it('상점은 scoutShop focus를 스카우트권 상점에 넘기고, 스카우트권 상점은 그 값으로 펼친 채 시작한다', () => {
    expect(shop).toMatch(/takeFocus\('scoutShop'\)/);
    expect(shop).toMatch(/<ScoutShop[^>]*focus=\{scoutFocus\}/);
    expect(shop).toMatch(/<RerollShop[^>]*focus=\{shopFocus\}/);
    expect(scoutShop).toMatch(/useState\(focus\)/);
  });
});
