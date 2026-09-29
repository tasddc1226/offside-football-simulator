// T-11-005 자리 — 기록실 묶음(C)이 채운다(웹 HallOfFame.svelte). full: 기록실 전체 보기, 아니면 홈 TOP 3.
import { Txt } from '../ui/Txt';

export function HallOfFame(_: { full?: boolean }) {
  return <Txt tone="muted">명예의 전당</Txt>;
}
