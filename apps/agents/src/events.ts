// 채팅 이벤트 → 역할 일(Task). 디스코드 게이트웨이(bridge.ts)가 받은 글을 여기서 고른다(T-11-576).
import { calledRoles, enabled, list, ROLES, stripCalls, type Env, type Role } from './env.ts';
import { alertSignature, ledger } from './ledger.ts';
import { isStopCommand, stopThread } from './stop.ts';
import { threadOf, type Task } from './thread.ts';

/** 채팅 메시지 모양(슬랙 Events API에서 물려받은 이름). 디스코드 메시지를 이 모양으로 옮겨 받는다(discordFormat.ts toSlackEvent). */
export type SlackEvent = {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  channel: string;
  ts: string;
  thread_ts?: string;
};

const IGNORED_SUBTYPES = new Set([
  'message_changed',
  'message_deleted',
  'channel_join',
  'channel_leave',
  'channel_topic',
  'channel_purpose',
]);
const stripMentions = (s: string) => s.replace(/<@[A-Z0-9]+>/g, '').trim();

/** 이 역할이 맡을 일인지 고른다. 아니면 null. */
export function decide(env: Env, role: Role, eventId: string, ev: SlackEvent): Task | null {
  // 에이전트 자기 글(역할 웹훅)은 브리지가 먼저 거른다(bridge.ts ours:).
  if (ev.subtype && IGNORED_SUBTYPES.has(ev.subtype)) return null;
  const text = ev.text ?? '';
  const base = { eventId, role, channel: ev.channel, sourceTs: ev.ts };
  const operator = ev.user === env.OPERATOR_USER_ID;
  if (ev.type === 'app_mention') {
    // 명령은 운영자만(ADR-015 보안).
    if (!operator) return null;
    return { ...base, kind: 'mention', threadTs: ev.thread_ts ?? ev.ts, text: stripMentions(text) };
  }
  if (ev.type !== 'message') return null;
  if (
    role === 'ops' &&
    list(env.ALERT_CHANNELS).includes(ev.channel) &&
    !ev.thread_ts &&
    (ev.bot_id || ev.subtype === 'bot_message')
  ) {
    // 정상 복구 알림은 정리할 원인이 없다.
    if (text.trimStart().startsWith('✅')) return null;
    return { ...base, kind: 'alert', threadTs: ev.ts, text };
  }
  // 한글로 부른 글(`@이운재 …`)은 부른 역할만 멘션으로 받는다. 다른 역할을 불렀으면 스레드 주인도 답하지 않는다.
  const called = operator ? calledRoles(text) : [];
  if (called.length)
    return called.includes(role)
      ? {
          ...base,
          kind: 'mention',
          threadTs: ev.thread_ts ?? ev.ts,
          text: stripCalls(stripMentions(text)),
        }
      : null;
  // T-11-325: 멘션 없는 답글 · 글로는 깨우지 않는다(불필요한 호출 줄이기). 일을 시키려면 봇을 멘션하거나 `@이름`으로 부른다.
  return null;
}

/** 고른 일을 스레드 객체에 넘긴다. 운영자 멈춤은 모델을 거치지 않고 바로 처리한다(stop.ts). */
export async function dispatchTask(env: Env, task: Task): Promise<void> {
  if (task.kind === 'mention' && isStopCommand(task.text)) {
    await stopThread(env, task);
    return;
  }
  // 같은 경보의 6시간 재안내는 24시간 안에 다시 정리하지 않는다(비용).
  if (task.kind === 'alert' && !(await ledger(env).freshAlert(alertSignature(task.text)))) return;
  await threadOf(env, task.role, task.channel, task.threadTs).enqueue(task);
}

/**
 * 디스코드 메시지 하나에서 맡을 일들. 봇 하나가 네 역할을 이름(웹훅)으로 나눠 쓰므로 역할별 멘션이 없다. 한글 이름(`@이운재`)으로 부른 글은 부른 역할이, 이름 없이 봇만 멘션한 운영자 글은 주장(@plan)이 맡는다.
 */
export function discordTasks(
  env: Env,
  eventId: string,
  ev: SlackEvent,
  mentioned: boolean,
): Task[] {
  const roles = ROLES.filter((r) => enabled(env, r));
  if (mentioned && ev.user === env.OPERATOR_USER_ID && !calledRoles(ev.text ?? '').length) {
    if (!roles.includes('plan')) return [];
    const t = decide(env, 'plan', eventId, { ...ev, type: 'app_mention' });
    return t ? [t] : [];
  }
  return roles.flatMap((r: Role) => decide(env, r, eventId, ev) ?? []);
}
