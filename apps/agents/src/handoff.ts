// ADR-015 넘기기 형식. 에이전트 답의 줄 머리에 `→ @역할: 요청`이 있으면 같은 스레드에서 그 역할에게 일을 넘긴다.
// 슬랙 이벤트를 거치지 않고 Worker 안에서 넘긴다(봇끼리의 메시지는 이벤트에서 무시한다). 스레드마다 6번까지.
import type { Role } from './env.ts';
import { isRole, list, ROLES, roleOfCall, type Env } from './env.ts';

export const MAX_HOPS = 6;

export type Handoff = { to: Role; request: string; back?: boolean };

/** 답에서 넘기기 줄을 찾는다. 자기 자신 · 모르는 역할 · 같은 역할 두 번은 뺀다. */
export function parseHandoffs(text: string, from: Role): Handoff[] {
  const out: Handoff[] = [];
  for (const line of text.split('\n')) {
    const m =
      /^\s*(?:[-*]\s*)?(?:\*\*)?(?:→|->)\s*@([a-z]+|[가-힣]+)\s*(?:\*\*)?\s*[:：]\s*(.+)$/.exec(
        line,
      );
    if (!m) continue;
    const name = m[1]!;
    const to = isRole(name) ? name : roleOfCall(name);
    if (!to || to === from || out.some((h) => h.to === to)) continue;
    out.push({ to, request: m[2]!.replace(/\*\*/g, '').trim() });
  }
  return out;
}

/**
 * 슬랙에 올릴 때 역할 키(`@ops` · `→ @plan:`)를 그 봇의 진짜 멘션(`<@U…>`)으로 바꾼다. 넘기기는 바꾸기 전 답으로 고르고,
 * 봇끼리의 멘션 이벤트는 받지 않으니(index.ts decide) 이 멘션으로 두 번 넘어가지 않는다. 코드 표기(`@plan`) 안은 그대로 둔다.
 */
export function linkRoles(env: Env, text: string): string {
  const users = list(env.AGENT_BOT_USERS);
  // 백틱으로 나눈 조각 중 짝수 번째만 코드 밖이다.
  return text
    .split('`')
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/(^|[\s(（])@(ops|plan|dev|mkt)\b/g, (all, pre: string, r: string) => {
            const u = users[ROLES.indexOf(r as Role)];
            return u ? `${pre}<@${u}>` : all;
          }),
    )
    .join('`');
}

/**
 * T-11-325 경보 첫 정리가 사건이라고 본 답인지. roles/ops.md: 장애로 보이면 첫 줄을 `사건: <한 줄>`로 쓴다.
 * 첫 줄만 본다(본문에 인용된 경보 글이 사건 판정을 흉내 내지 못하게).
 */
export const isIncident = (reply: string) =>
  /^\s*(?:\*\*)?사건(?:\*\*)?\s*[:：]/.test(reply.split('\n').find((l) => l.trim()) ?? '');
