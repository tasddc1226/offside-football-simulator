// ADR-015 넘기기 형식. 에이전트 답의 줄 머리에 `→ @역할: 요청`이 있으면 같은 스레드에서 그 역할에게 일을 넘긴다.
// 슬랙 이벤트를 거치지 않고 Worker 안에서 넘긴다(봇끼리의 메시지는 이벤트에서 무시한다). 스레드마다 6번까지.
import type { Role } from './env.ts';
import { isRole } from './env.ts';

export const MAX_HOPS = 6;

export type Handoff = { to: Role; request: string };

/** 답에서 넘기기 줄을 찾는다. 자기 자신 · 모르는 역할 · 같은 역할 두 번은 뺀다. */
export function parseHandoffs(text: string, from: Role): Handoff[] {
  const out: Handoff[] = [];
  for (const line of text.split('\n')) {
    const m = /^\s*(?:[-*]\s*)?(?:\*\*)?(?:→|->)\s*@([a-z]+)\s*(?:\*\*)?\s*[:：]\s*(.+)$/.exec(
      line,
    );
    if (!m) continue;
    const to = m[1]!;
    if (!isRole(to) || to === from || out.some((h) => h.to === to)) continue;
    out.push({ to, request: m[2]!.replace(/\*\*/g, '').trim() });
  }
  return out;
}
