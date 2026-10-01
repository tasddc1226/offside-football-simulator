// T-11-022 업무 모드: PC 브라우저에서 게임을 스프레드시트 화면처럼 보이게 한다. 설정에서 켜고 이 기기에 저장한다.
// 마우스로 쓰는 넓은 화면에서만 적용한다 — 휴대폰·태블릿은 켜 둬도 원래 화면이다(창을 좁히면 그 자리에서 풀린다).
// 첫 페인트 전 적용은 index.html의 인라인 스크립트가 같은 키·같은 매체 쿼리로 한다. 모양은 style.css의 [data-skin='sheet'].
const KEY = 'ft_skin';
export const SHEET_MEDIA = '(hover: hover) and (pointer: fine) and (min-width: 900px)';
/** 업무 모드 문서 제목·파비콘(녹색 표 아이콘). */
export const SHEET_TITLE = '4분기 업무 정리_v3 - 스프레드시트';
const SHEET_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='2' y='1' width='12' height='14' rx='1.5' fill='%2334a853'/%3E%3Cpath d='M4.5 6h7v6h-7zM4.5 8h7M4.5 10h7M7.5 6v6' fill='none' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E";

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) === 'sheet';
  } catch {
    return false;
  }
}

const mq = typeof matchMedia === 'function' ? matchMedia(SHEET_MEDIA) : null;
export const skin = $state({ pref: readPref(), desktop: mq?.matches ?? false });
export const sheetOn = (): boolean => skin.pref && skin.desktop;

let realTitle = '';
const realIcons = new Map<HTMLLinkElement, string>();

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (sheetOn()) {
    root.dataset.skin = 'sheet';
    if (document.title !== SHEET_TITLE) realTitle = document.title;
    document.title = SHEET_TITLE;
    for (const l of document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) {
      if (!realIcons.has(l)) realIcons.set(l, l.href);
      l.href = SHEET_ICON;
    }
  } else if (root.dataset.skin) {
    delete root.dataset.skin;
    if (realTitle) document.title = realTitle;
    for (const [l, href] of realIcons) l.href = href;
    realIcons.clear();
  }
}

mq?.addEventListener('change', (e) => {
  skin.desktop = e.matches;
  apply();
});
apply();

export function setSheetSkin(on: boolean) {
  skin.pref = on;
  try {
    if (on) localStorage.setItem(KEY, 'sheet');
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 공간을 못 쓰면 이번 방문에만 적용한다.
  }
  apply();
}
