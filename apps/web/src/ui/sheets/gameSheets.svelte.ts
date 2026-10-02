// ───────── 게임 시트 본문 지연 로딩 ─────────
// T-10-104: 이벤트·시즌 결산·이적시장 시트는 actions.ts(→ 게임 엔진)를 쓰므로 첫 화면 번들에서 뗀다.
// 컴포넌트를 모듈 상태에 담아 두면 한 번 불러온 뒤엔 시트가 열리는 프레임에 바로 그려져 깜빡임·포커스 누락이 없다.
import type { Component } from 'svelte';
import type { SheetView } from '@offside/app-core/sheets';

export type GameSheetView = Extract<
  SheetView,
  { kind: 'event' | 'eventResult' | 'season' | 'market' | 'contract' | 'flight' }
>;
const GAME_KINDS = new Set<SheetView['kind']>([
  'event',
  'eventResult',
  'season',
  'market',
  'contract',
  'flight',
]);
/** 게임 청크가 필요한 시트인지. */
export const isGameSheet = (v: SheetView): v is GameSheetView => GAME_KINDS.has(v.kind);

export const gameSheets = $state<{ C: Component<{ v: GameSheetView }> | null }>({ C: null });

let loading: Promise<void> | null = null;
/** 게임 시트 본문을 불러온다(여러 번 불러도 한 번만). 실패하면 다음 호출에서 다시 시도한다. */
export function loadGameSheets(): Promise<void> {
  loading ??= import('./PlaySheets.svelte').then(
    (m) => void (gameSheets.C = m.default),
    (e) => {
      loading = null;
      throw e;
    },
  );
  return loading;
}
