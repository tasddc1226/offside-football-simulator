// ───────── 시트 상태 ─────────
// 시트 연출(진행 단계·경기 중계·판정·미니게임)은 웹·앱 공용(@offside/app-core/sheet-controller, T-11-002)이다.
// 웹은 상태를 Svelte `$state`로 감싸고, 포커스·스크롤·장면 지연 로드만 붙인다.
import { tick } from 'svelte';
import {
  createSheetController,
  initialSheetState,
  type SheetState,
} from '@offside/app-core/sheet-controller';
import { motionOK } from './motion.js';

export type { SheetButton, SheetView, Chip } from '@offside/app-core/sheets';

export const sheetState = $state<SheetState>(initialSheetState());

let sheetEl: HTMLElement | null = null;
/** Sheet.svelte가 실제 시트 노드를 등록한다(열릴 때 스크롤·포커스 초기화용). */
export function registerSheetEl(el: HTMLElement | null) {
  sheetEl = el;
}

export const sheet = createSheetController(sheetState, {
  tick,
  painted: () =>
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  afterShow: () => {
    if (sheetEl) sheetEl.scrollTop = 0;
    sheetEl?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  },
  focusFirstButton: () =>
    sheetEl?.querySelector<HTMLButtonElement>('[data-sheet="0"]')?.focus({ preventScroll: true }),
  preloadMinigame: () => import('./sheets/Minigame.svelte'),
  motionOK: () => motionOK,
});
export const { showSheet, closeSheet } = sheet;
