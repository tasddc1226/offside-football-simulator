// T-11-005 자리 — 기록실 묶음(C)이 채운다(웹 NicknameForm.svelte).
import { Txt } from '../ui/Txt';

export function NicknameForm(_: { current?: string | null; onsaved?: (nickname: string) => void }) {
  return <Txt tone="muted">닉네임</Txt>;
}
