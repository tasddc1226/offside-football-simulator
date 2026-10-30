// T-11-423 홈 팝업은 한 방문(앱 실행)에 하나만 띄운다(iOS는 Modal 두 개를 함께 띄우지 못하고, 웹도 두 장이 겹치면 닫기가 헷갈린다).
// T-11-423c 저절로 뜨는 창은 출석 → 컵 우승 → 제휴 순서로 자리를 잡는다. 뒤 순서 창은 앞 순서 창이 띄울지 정할 때까지(응답이
// 늦으면 TURN_WAIT_MS까지) 기다린다. 이용 분석 동의 창은 이 순서보다 앞이라 각 창이 따로 확인한다.
export type HomePopupKind = 'attendance' | 'cup' | 'partner';
const ORDER: readonly HomePopupKind[] = ['attendance', 'cup', 'partner'];
export const TURN_WAIT_MS = 3000;

let taken = false;
const settled = new Set<HomePopupKind>();
const waiters = new Set<() => void>();
const notify = () => [...waiters].forEach((f) => f());

/** 앞 순서 창이 모두 띄울지 정했거나 자리가 이미 찼을 때까지 기다린다(최대 waitMs). */
export function homePopupTurn(kind: HomePopupKind, waitMs = TURN_WAIT_MS): Promise<void> {
  const ahead = ORDER.slice(0, ORDER.indexOf(kind));
  const ready = () => taken || ahead.every((k) => settled.has(k));
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      waiters.delete(check);
      resolve();
    };
    const check = () => ready() && done();
    const timer = setTimeout(done, waitMs);
    waiters.add(check);
  });
}

/** 이번 방문에는 이 창을 저절로 띄우지 않는다고 알린다(뒤 순서 창이 더 기다리지 않는다). */
export function passHomePopup(kind: HomePopupKind): void {
  settled.add(kind);
  notify();
}

/** 이번 방문의 홈 팝업 자리를 잡는다. 이미 다른 창이 잡았으면 false. 차례는 homePopupTurn으로 먼저 기다린다. */
export function claimHomePopup(kind: HomePopupKind): boolean {
  const ok = !taken;
  taken = true;
  passHomePopup(kind);
  return ok;
}

/** 테스트용. */
export function resetHomePopup(): void {
  taken = false;
  settled.clear();
  waiters.clear();
}
