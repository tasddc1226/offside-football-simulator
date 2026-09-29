// T-11-005 자리 — 기록실 묶음(C)이 채운다(웹 team/TeamPitch.svelte · TeamLines.svelte).
import type { FormationId } from '@offside/contracts/owner-team';
import type { TeamLines as Lines } from '@offside/app-core/api/team';
import { Txt } from '../ui/Txt';

export type PitchCell = { rating: number; name: string; youth: boolean };

export function TeamPitch(_: {
  formation: FormationId;
  cells: readonly PitchCell[];
  onpick?: ((i: number) => void) | undefined;
}) {
  return <Txt tone="muted">선발</Txt>;
}

export function TeamLines(_: { lines: Lines }) {
  return <Txt tone="muted">라인</Txt>;
}
