// T-11-005 자리 — 은퇴 묶음(D)이 채운다(웹 tabs/CareerTab.svelte — 시즌별 기록 표 + 몸값 그래프).
import type { GameState, LegendSource } from '@offside/game/types';
import { Txt } from '../ui/Txt';

export function CareerTab(_: { s: LegendSource | GameState; chart?: boolean }) {
  return <Txt tone="muted">커리어</Txt>;
}
