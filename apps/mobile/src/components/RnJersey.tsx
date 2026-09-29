// T-11-005 자리 — 기록실 묶음(C)이 채운다(웹 RnJersey.svelte — 구단 색 영구결번 유니폼).
import { Txt } from '../ui/Txt';

export function RnJersey({ name, number }: { name: string; number: number }) {
  return <Txt>{`${name} ${number}`}</Txt>;
}
