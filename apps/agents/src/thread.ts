// 슬랙 스레드 하나 = 역할마다 객체 하나. 일을 받은 순서대로 하나씩 처리하고, 이어지는 지시를 위해 대화 요약 · 비용을 저장한다.
// 운영 D1은 쓰지 않는다(ADR-015 인프라).
import { DurableObject } from 'cloudflare:workers';
import { ClaudeError, MODEL_LABEL, runAgent, type Message, type Tool } from './claude.ts';
import { apiKey, botToken, dailyBudget, enabled, ROLE_NAMES, type Env, type Role } from './env.ts';
import { MAX_HOPS, parseHandoffs } from './handoff.ts';
import { kstDay, ledger } from './ledger.ts';
import { mcpTools, type McpServer } from './mcp.ts';
import { roleSpec } from './roles.ts';
import { slackClient, threadReply } from './slack.ts';

export type Task = {
  eventId: string;
  /** triage: 유저 반응 살피기, report: 아침 주기 작업 보고, support: 고객 문의 메일, release: 운영 배포 뒤 드림보트 요약(넷 다 새 글로 올린다). handoff: 다른 에이전트가 넘긴 일. */
  kind: 'alert' | 'mention' | 'reply' | 'triage' | 'report' | 'support' | 'release' | 'handoff';
  role: Role;
  channel: string;
  /** 답을 달 스레드(첫 메시지 ts). 새 글(triage · report)은 아직 없다(올린 글이 스레드가 된다). */
  threadTs: string;
  /** 반응(👀)을 달 메시지 ts. 없으면 달지 않는다. */
  sourceTs: string;
  text: string;
  /** handoff: 넘긴 역할과 그 답 전체. */
  from?: Role;
  context?: string;
};

/** owner: 이 역할이 연 스레드인지. 넘겨받기만 한 스레드에선 운영자 답글을 받지 않는다(한 답글에 두 봇이 답하지 않게). */
type State = { history: Message[]; costUsd: number; runs: number; owner?: boolean };

/** 이어지는 지시에 넘길 대화(사람 지시 · 에이전트 답만, 도구 기록은 뺀다). */
const HISTORY = 12;
/** 반응 살피기에서 검토할 글이 없을 때 @plan이 쓰는 한 줄(roles/plan.md). */
export const NOTHING = '검토할 반응 없음';

const isNewPost = (t: Task) =>
  t.kind === 'triage' || t.kind === 'report' || t.kind === 'support' || t.kind === 'release';

export const threadOf = (env: Env, role: Role, channel: string, threadTs: string) =>
  env.THREAD.get(env.THREAD.idFromName(`${role}:${channel}:${threadTs}`));

export class AgentThread extends DurableObject<Env> {
  async enqueue(task: Task): Promise<'queued' | 'duplicate' | 'ignored'> {
    const s = this.ctx.storage;
    const seen = (await s.get<string[]>('seen')) ?? [];
    if (seen.includes(task.eventId)) return 'duplicate';
    await s.put('seen', [...seen, task.eventId].slice(-100));
    // 이 역할이 연 스레드의 답글만 받는다(넘겨받기만 한 스레드 · 남의 스레드는 무시).
    const state = await s.get<State>('state');
    if (task.kind === 'reply' && (!state || state.owner === false)) return 'ignored';
    const queue = (await s.get<Task[]>('queue')) ?? [];
    queue.push(task);
    await s.put('queue', queue);
    if ((await s.getAlarm()) == null) await s.setAlarm(Date.now());
    return 'queued';
  }

  /** 새 글로 올린 반응 정리를 그 스레드 객체에 옮긴다(운영자 답글을 이어 받게). */
  async seed(state: State): Promise<void> {
    await this.ctx.storage.put('state', state);
  }

  override async alarm() {
    for (;;) {
      const queue = (await this.ctx.storage.get<Task[]>('queue')) ?? [];
      const task = queue.shift();
      if (!task) return;
      await this.ctx.storage.put('queue', queue);
      // 실패해도 던지지 않는다(알람 재시도가 같은 일을 다시 돌려 비용이 두 번 든다).
      await this.handle(task).catch((e: unknown) =>
        console.error('agent task failed', task.role, String(e)),
      );
    }
  }

  private async handle(task: Task) {
    const env = this.env;
    const slack = slackClient(botToken(env, task.role), fetch, ROLE_NAMES[task.role]);
    const book = ledger(env);
    const today = await book.day(task.role);
    if (today.costUsd >= dailyBudget(env, task.role)) {
      if (!isNewPost(task) && (await book.warnOnce(task.role)))
        await slack(
          'chat.postMessage',
          threadReply(
            task.channel,
            task.threadTs,
            '오늘 쓸 수 있는 금액을 다 써서 내일까지 새 일을 받지 않아요.',
          ),
        );
      return;
    }
    if (task.sourceTs)
      await slack('reactions.add', {
        channel: task.channel,
        timestamp: task.sourceTs,
        name: 'eyes',
      });
    const state = (await this.ctx.storage.get<State>('state')) ?? {
      history: [],
      costUsd: 0,
      runs: 0,
      owner: task.kind !== 'handoff',
    };
    const spec = roleSpec(env, task.role, task);
    const prompt = spec.prompt(task);
    let reply: string;
    let footer: string | undefined;
    let ok = false;
    try {
      const r = await runAgent({
        apiKey: apiKey(env, task.role),
        system: spec.system,
        tools: [...spec.tools, ...(await loadMcp(spec.mcpServers))],
        messages: [...state.history, { role: 'user', content: prompt }],
        maxTurns: spec.maxTurns,
        budgetUsd: Number(env.TASK_BUDGET_USD),
        model: spec.model,
      });
      const day = await book.add(task.role, r.costUsd);
      // 검토할 반응이 없으면 슬랙에 올리지 않는다(비용만 적는다).
      if (task.kind === 'triage' && r.text.trim().startsWith(NOTHING)) {
        console.log('triage: nothing', r.costUsd.toFixed(3));
        return;
      }
      reply =
        (r.text || '정리할 내용을 만들지 못했어요.') +
        (r.stopped === 'budget'
          ? '\n\n_작업 한도 금액에 닿아 여기서 멈췄어요. 이어서 하려면 다시 불러 주세요._'
          : '') +
        (r.stopped === 'turns'
          ? '\n\n_조회 횟수 한도에 닿아 여기서 멈췄어요. 이어서 하려면 다시 불러 주세요._'
          : '');
      footer = `${MODEL_LABEL[spec.model]} · ${r.turns}턴 · $${r.costUsd.toFixed(3)} · 오늘 ${task.role} $${day.costUsd.toFixed(2)} (${kstDay()})`;
      state.history = [
        ...state.history,
        { role: 'user', content: prompt },
        { role: 'assistant', content: reply },
      ].slice(-HISTORY) as Message[];
      state.costUsd += r.costUsd;
      state.runs += 1;
      ok = true;
    } catch (e) {
      // 반응 살피기 실패는 올릴 곳이 없으니 로그만 남긴다. 아침 보고 실패는 새 글로 알린다.
      if (task.kind === 'triage') {
        console.error('triage failed', String(e).slice(0, 300));
        return;
      }
      reply = failureText(e);
    }
    const posted = await slack(
      'chat.postMessage',
      threadReply(task.channel, isNewPost(task) ? undefined : task.threadTs, reply, footer),
    );
    if (task.sourceTs)
      await slack('reactions.remove', {
        channel: task.channel,
        timestamp: task.sourceTs,
        name: 'eyes',
      });
    if (!ok) return;
    // 새 글은 올린 글이 스레드가 된다. 그 스레드 객체가 대화를 이어 받는다.
    const threadTs = isNewPost(task) ? posted.ts : task.threadTs;
    if (!threadTs) return;
    if (isNewPost(task)) await threadOf(env, task.role, task.channel, threadTs).seed(state);
    else await this.ctx.storage.put('state', state);
    await this.passOn(task, threadTs, posted.ts ?? threadTs, reply);
  }

  /** 답의 `→ @역할:` 줄대로 같은 스레드에서 다른 에이전트에게 넘긴다. 스레드마다 MAX_HOPS번까지. */
  private async passOn(task: Task, threadTs: string, replyTs: string, reply: string) {
    const env = this.env;
    for (const h of parseHandoffs(reply, task.role)) {
      if (!enabled(env, h.to)) continue;
      const n = await ledger(env).hop(`${task.channel}:${threadTs}`);
      if (n > MAX_HOPS) {
        await slackClient(
          botToken(env, task.role),
          fetch,
          ROLE_NAMES[task.role],
        )(
          'chat.postMessage',
          threadReply(
            task.channel,
            threadTs,
            `이 스레드에서 에이전트끼리 ${MAX_HOPS}번 주고받아서 더 넘기지 않아요. 이어서 하려면 운영자가 불러 주세요.`,
          ),
        );
        return;
      }
      await threadOf(env, h.to, task.channel, threadTs).enqueue({
        eventId: `handoff:${threadTs}:${n}`,
        kind: 'handoff',
        role: h.to,
        channel: task.channel,
        threadTs,
        sourceTs: replyTs,
        text: h.request,
        from: task.role,
        context: reply,
      });
    }
  }
}

/** MCP 서버가 안 되면 그 도구 없이 진행한다(역할 기본 도구로는 계속 일할 수 있다). */
async function loadMcp(servers: McpServer[]): Promise<Tool[]> {
  const out: Tool[] = [];
  for (const s of servers) {
    try {
      out.push(...(await mcpTools(s)));
    } catch (e) {
      console.error('mcp unavailable', s.name, String(e).slice(0, 200));
    }
  }
  return out;
}

export function failureText(e: unknown): string {
  if (e instanceof ClaudeError) {
    if (e.status === 401 || e.status === 403)
      return `Claude API 키를 확인해 주세요 (${e.status}). 작업을 멈췄어요.`;
    if (e.status === 429 || e.status === 529)
      return 'Claude API가 바빠서 멈췄어요. 잠시 뒤 다시 불러 주세요.';
    if (e.status === 0) return `응답 모델이 Opus 5.5가 아니라서 멈췄어요 (${e.message}).`;
    return `Claude API 오류로 멈췄어요 (${e.status} ${e.message}). 지출 한도에 닿았을 수도 있어요.`;
  }
  return '처리하다 오류가 나서 멈췄어요. 로그를 확인해 주세요.';
}
