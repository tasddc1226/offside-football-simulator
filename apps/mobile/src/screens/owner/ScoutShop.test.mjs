/* global vi, beforeEach, describe, it, expect */
// T-11-672 스카우트권 상점의 focus 동작 — 실제 ScoutShop 함수를 실행해 돌려준 요소 트리를 본다. React 렌더러 없이
// useState · useRef만 흉내 낸 훅으로 돌리고 자식 컴포넌트는 이름만 남긴다: 실제 RN 화면 · 레이아웃 · 스크롤은 확인하지 않는다.
const h = vi.hoisted(() => ({
  states: [],
  refs: [],
  i: 0,
  j: 0,
  prefs: { motionOK: false },
  scrollToView: vi.fn(),
}));
vi.mock('react', () => ({
  useState: (init) => {
    const k = h.i++;
    if (!(k in h.states)) h.states[k] = typeof init === 'function' ? init() : init;
    return [h.states[k], (v) => (h.states[k] = typeof v === 'function' ? v(h.states[k]) : v)];
  },
  useRef: (init) => {
    const k = h.j++;
    if (!(k in h.refs)) h.refs[k] = { current: init };
    return h.refs[k];
  },
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@offside/app-core/design-tokens', () => ({ FONT: { label: 1, body2: 1, title1: 1 } }));
vi.mock('@offside/app-core/i18n/ko/cup', () => ({
  cupText: { shopOpen: 'open', shopClose: 'close' },
}));
vi.mock('@offside/app-core/i18n/ko/scout', () => ({
  scoutText: {
    title: 'title',
    shopSub: 'sub',
    shopSubHave: () => 'have',
    shopNote: 'note',
    pityHelp: () => 'pity',
  },
}));
vi.mock('@offside/app-core/scoutOdds', () => ({ scoutWhatText: () => 'what' }));
vi.mock('@offside/contracts/cup', () => ({ scoutPityAt: () => ({}) }));
vi.mock('../../platform/iapItems', () => ({ useIapItems: () => ({ items: null }) }));
vi.mock('../../store', () => ({ prefs: h.prefs }));
vi.mock('../../theme/type', () => ({ rem: (n) => n }));
vi.mock('../../ui/scroll', () => ({ scrollToView: h.scrollToView }));
vi.mock('../../ui', () => ({ Card: 'Card', Press: 'Press', Txt: 'Txt' }));
vi.mock('./IapPacks', () => ({ IapPacks: 'IapPacks' }));
vi.mock('./ScoutFunds', () => ({ ScoutFunds: 'ScoutFunds' }));
vi.mock('./ScoutOdds', () => ({ ScoutOdds: 'ScoutOdds' }));

import { ScoutShop } from './ScoutShop';

/** 같은 훅 상태로 다시 그린다(상태를 바꾼 뒤 부르면 다음 렌더). */
function render(props) {
  h.i = 0;
  h.j = 0;
  return ScoutShop(props);
}
function find(node, pred) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = find(n, pred);
      if (hit) return hit;
    }
    return null;
  }
  if (pred(node)) return node;
  return find(node.props?.children, pred);
}
const packs = (tree) => find(tree, (n) => n.type === 'IapPacks');
const toggle = (tree) => find(tree, (n) => n.props?.testID === 'scout-shop-toggle');
/** onLayout이 붙은 바깥 View에 측정할 대상을 넣고 레이아웃을 한 번 알린다. */
function layout(tree, target) {
  const box = find(tree, (n) => n.type === 'View' && n.props?.onLayout);
  box.props.ref.current = target;
  box.props.onLayout();
}

beforeEach(() => {
  h.states = [];
  h.refs = [];
  h.prefs.motionOK = false;
  h.scrollToView.mockClear();
});

describe('ScoutShop focus', () => {
  it('focus면 펼친 채로 열려 스카우트권 묶음이 보인다', () => {
    const tree = render({ focus: true });
    expect(packs(tree)?.props.item).toBe('scout');
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: true });
  });

  it('기본 진입은 접혀 있어 묶음이 없다', () => {
    const tree = render({});
    expect(packs(tree)).toBeNull();
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: false });
  });

  it('focus면 첫 레이아웃에 한 번만 그 자리로 스크롤하고 움직임 설정을 넘긴다', () => {
    const target = { id: 'box' };
    let tree = render({ focus: true });
    layout(tree, target);
    expect(h.scrollToView).toHaveBeenCalledTimes(1);
    expect(h.scrollToView).toHaveBeenCalledWith(target, false);
    tree = render({ focus: true });
    layout(tree, target);
    expect(h.scrollToView).toHaveBeenCalledTimes(1);
  });

  it('움직임을 허용하면 motionOK true를 넘긴다', () => {
    h.prefs.motionOK = true;
    const target = { id: 'box' };
    layout(render({ focus: true }), target);
    expect(h.scrollToView).toHaveBeenCalledWith(target, true);
  });

  it('기본 진입은 레이아웃이 와도 자동 스크롤하지 않는다', () => {
    const tree = render({});
    layout(tree, { id: 'box' });
    layout(render({}), { id: 'box' });
    expect(h.scrollToView).not.toHaveBeenCalled();
  });

  it('focus로 펼친 뒤 머리를 누르면 닫히고 다시 누르면 열린다', () => {
    toggle(render({ focus: true })).props.onPress();
    let tree = render({ focus: true });
    expect(packs(tree)).toBeNull();
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: false });
    toggle(tree).props.onPress();
    tree = render({ focus: true });
    expect(packs(tree)?.props.item).toBe('scout');
  });
});
