// T-11-480 카카오 애드핏 배너. AdSense 단위가 없는 위치에서 한국어 화면에만 쓴다(해외 광고 수요가 거의 없고 유럽 동의 절차가 없다).
// 단위는 애드핏에서 위치별로 만든 320x100 배너를 VITE_ADFIT_UNITS({"records-bottom":"DAN-…"})로 넘긴다.
// 스크립트는 첫 칸이 보일 때 한 번만 불러온다. 화면을 떠나 칸이 문서에서 빠지면 애드핏이 알아서 정리한다.
import type { AdPlace } from '@offside/app-core/adPolicy';
import { getLocale } from '@offside/app-core/i18n/core';

const units: Partial<Record<AdPlace, string>> = (() => {
  try {
    return JSON.parse(String(import.meta.env.VITE_ADFIT_UNITS || '{}')) as Partial<
      Record<AdPlace, string>
    >;
  } catch {
    return {};
  }
})();

export const ADFIT_WIDTH = 320;
export const ADFIT_HEIGHT = 100;
/** 애드핏이 광고를 채우지 못하면 부르는 전역 함수 이름(data-ad-onfail). 칸 요소를 넘겨받는다. */
export const ADFIT_FAIL = 'offsideAdfitFail';
export const ADFIT_FAIL_EVENT = 'adfit-fail';

export const adfitUnitOf = (place: AdPlace): string | undefined =>
  getLocale() === 'ko' && /^DAN-[A-Za-z0-9]+$/.test(units[place] ?? '') ? units[place] : undefined;

type AdfitWindow = Window &
  typeof globalThis & {
    adfit?: { render?: (el: HTMLElement) => void };
    [ADFIT_FAIL]?: (el: HTMLElement) => void;
  };
let loading: Promise<void> | null = null;
function load(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const w = window as AdfitWindow;
    w[ADFIT_FAIL] = (el) => el.dispatchEvent(new CustomEvent(ADFIT_FAIL_EVENT));
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://t1.daumcdn.net/kas/static/ba.min.js';
    script.onload = () => resolve();
    // 광고 차단기에 막히면 이 탭에서는 다시 시도하지 않는다.
    script.onerror = () => reject(new Error('adfit blocked'));
    document.head.append(script);
  });
  return loading;
}

/** 칸 하나를 채워 달라고 요청한다. 스크립트가 처음 뜰 때 문서의 칸을 스스로 찾아 그리므로,
 * 애드핏이 아직 맡지 않은 칸(data-ad-onfail이 남아 있는 칸)만 직접 넘긴다. */
export async function requestAdfit(ins: HTMLElement): Promise<boolean> {
  try {
    await load();
    if (!ins.isConnected || !ins.hasAttribute('data-ad-onfail')) return true;
    const render = (window as AdfitWindow).adfit?.render;
    if (!render) return false;
    render(ins);
    return true;
  } catch {
    return false;
  }
}
