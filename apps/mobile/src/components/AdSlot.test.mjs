/* global vi, beforeEach, afterEach, describe, it, expect */
// 배너 광고 칸(AdSlot)이 광고 제거 권리(평생 구매 · 멤버십 구독)를 따르는지 본다.
// 렌더러 없이 useState · useEffect(의존성 · 정리 포함)만 흉내 내 컴포넌트 함수를 직접 부른다.
// 한계: useSnapshot은 지금 값을 돌려주는 가짜라, valtio 값이 바뀔 때 React가 스스로 다시 그리는지(구독)는
// 확인하지 못한다. 여기서는 다시 그렸을 때 칸이 접히는지만 본다.
const f = vi.hoisted(() => ({
  ad: { owned: false, member: false },
  consent: vi.fn(),
  shouldShow: vi.fn(),
  hooks: null,
}));

vi.mock('react', () => {
  const useState = (init) => {
    const h = f.hooks;
    const i = h.i++;
    if (!(i in h.slots)) h.slots[i] = typeof init === 'function' ? init() : init;
    return [
      h.slots[i],
      (v) => {
        h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v;
      },
    ];
  };
  // 의존성이 바뀐 효과만 그린 뒤에 돌리고, 그 전 정리 함수를 먼저 부른다(React와 같은 순서).
  const useEffect = (fn, deps) => {
    const h = f.hooks;
    const i = h.i++;
    const prev = h.slots[i];
    const changed = !prev || !deps || deps.some((d, k) => !Object.is(d, prev.deps[k]));
    if (!changed) return;
    h.effects.push(() => {
      prev?.cleanup?.();
      h.slots[i] = { deps, cleanup: fn() };
    });
  };
  const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
  return { default: { createElement, useState, useEffect }, createElement, useState, useEffect };
});
vi.mock('react/jsx-runtime', () => {
  const jsx = (type, props) => ({ type, props });
  return { jsx, jsxs: jsx, Fragment: 'Fragment' };
});
vi.mock('react/jsx-dev-runtime', () => {
  const jsxDEV = (type, props) => ({ type, props });
  return { jsxDEV, Fragment: 'Fragment' };
});
vi.mock('valtio', () => ({ useSnapshot: (s) => ({ ...s }) }));
vi.mock('react-native', () => ({
  Platform: { select: (units) => units.ios },
  View: 'View',
}));
vi.mock('react-native-google-mobile-ads', () => ({
  BannerAd: 'BannerAd',
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  TestIds: { BANNER: 'test-banner' },
}));
vi.mock('@offside/app-core/design-tokens', () => ({ FONT: { caption2: 0.7 } }));
vi.mock('@offside/app-core/i18n/ko/shellMore', () => ({ shellMoreText: { adLabel: 'ad' } }));
vi.mock('@offside/app-core/adPolicy', () => ({ shouldShow: f.shouldShow }));
vi.mock('../platform/adConsent', () => ({
  askConsent: f.consent,
  adRequestOptions: () => ({ requestNonPersonalizedAdsOnly: true }),
}));
// adFree.ts는 스토어 모듈을 불러오므로 같은 판단식(adsOff)을 가진 가짜로 바꾼다.
vi.mock('../platform/adFree', () => ({
  adFree: f.ad,
  adsOff: (s) => s.owned || s.member,
}));
vi.mock('../theme/type', () => ({ rem: (n) => n * 16 }));
vi.mock('../ui/Txt', () => ({ Txt: 'Txt' }));

beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  vi.resetModules();
  vi.clearAllMocks();
  f.ad.owned = false;
  f.ad.member = false;
  f.consent.mockResolvedValue(true);
  f.shouldShow.mockReturnValue(true);
});
afterEach(() => vi.unstubAllGlobals());

const flush = () => new Promise((r) => setTimeout(r, 0));

/** 모듈을 새로 불러온다(위치별 마지막 요청 시각도 새로 시작). */
const load = async () => (await import('./AdSlot')).AdSlot;

/** 칸 하나를 마운트한다. render()는 같은 인스턴스를 다시 그리고, layout()은 칸 폭을 알린다. */
function mount(AdSlot, place = 'records-bottom') {
  const slots = [];
  let out;
  const render = () => {
    f.hooks = { slots, i: 0, effects: [] };
    out = AdSlot({ place });
    for (const fn of f.hooks.effects) fn();
    return out;
  };
  const layout = (width = 320) => out?.props.onLayout({ nativeEvent: { layout: { width } } });
  return { render, layout, first: render() };
}

/** 그린 결과 안에 실제 배너(BannerAd)가 있는지. */
const hasBanner = (node) =>
  !!node &&
  typeof node === 'object' &&
  (node.type === 'BannerAd' || [node.props?.children].flat().some(hasBanner));

describe('AdSlot 광고 제거 권리', () => {
  it('광고 제거가 없는 구단주에게는 동의를 거쳐 배너를 그린다', async () => {
    const slot = mount(await load());
    expect(slot.first).not.toBeNull();
    expect(f.consent).toHaveBeenCalledTimes(1);
    await flush();
    slot.layout();
    expect(hasBanner(slot.render())).toBe(true);
  });

  it('멤버십 구독 중이면 노출 규칙 · 간격을 보기 전에 막고 광고를 요청하지 않는다', async () => {
    f.ad.member = true;
    const slot = mount(await load());
    expect(slot.first).toBeNull();
    expect(f.shouldShow).not.toHaveBeenCalled();
    expect(f.consent).not.toHaveBeenCalled();
  });

  it('평생 광고 제거를 샀으면 칸을 두지 않는다', async () => {
    f.ad.owned = true;
    const slot = mount(await load());
    expect(slot.first).toBeNull();
    expect(f.shouldShow).not.toHaveBeenCalled();
    expect(f.consent).not.toHaveBeenCalled();
  });

  it('멤버십이 끝나도 평생 광고 제거는 그대로 칸을 막는다', async () => {
    f.ad.owned = true;
    f.ad.member = true;
    const AdSlot = await load();
    expect(mount(AdSlot).first).toBeNull();
    f.ad.member = false; // 만료 · 해지
    expect(mount(AdSlot).first).toBeNull();
    expect(f.consent).not.toHaveBeenCalled();
  });

  it('멤버십이 끝나거나 다른 계정으로 바뀐 뒤 새로 마운트한 칸은 다시 광고를 둔다', async () => {
    f.ad.member = true;
    const AdSlot = await load();
    expect(mount(AdSlot).first).toBeNull();
    f.ad.member = false; // membership.ts가 만료 · 로그아웃 · 계정 전환 때 false로 둔다
    const next = mount(AdSlot);
    expect(next.first).not.toBeNull();
    expect(f.shouldShow).toHaveBeenCalledTimes(1);
    expect(f.consent).toHaveBeenCalledTimes(1);
  });

  it('보고 있던 칸도 멤버십을 시작하면 다시 그릴 때 접는다', async () => {
    const slot = mount(await load());
    expect(slot.first).not.toBeNull();
    f.ad.member = true;
    expect(slot.render()).toBeNull();
  });

  it('보고 있던 칸도 평생 광고 제거를 사면 다시 그릴 때 접는다', async () => {
    const slot = mount(await load());
    expect(slot.first).not.toBeNull();
    f.ad.owned = true;
    expect(slot.render()).toBeNull();
  });

  it('동의 창이 멤버십 시작 뒤에 끝나도 배너를 그리지 않는다', async () => {
    let finish;
    f.consent.mockReturnValue(new Promise((r) => (finish = r)));
    const slot = mount(await load());
    expect(slot.first).not.toBeNull();
    slot.layout();
    f.ad.member = true; // 동의 창이 떠 있는 동안 구독이 시작됨
    finish(true);
    await flush();
    const out = slot.render();
    expect(out).toBeNull();
    expect(hasBanner(out)).toBe(false);
  });
});
