// 슬랙 스레드 하나 = 역할마다 객체 하나. 일을 받은 순서대로 하나씩 처리하고, 이어지는 지시를 위해 대화 요약 · 비용을 저장한다.
// 운영 D1은 쓰지 않는다(ADR-015 인프라).
import { DurableObject } from 'cloudflare:workers';
import { ClaudeError, MODEL_LABEL, runAgent, type Message, type Tool } from './claude.ts';
import { apiKey, dailyBudget, enabled, type Env, type Role } from './env.ts';
import { cardOf } from './card.ts';
import { isIncident, linkRoles, MAX_HOPS, parseHandoffs } from './handoff.ts';
import { kstDay, ledger } from './ledger.ts';
import { mcpTools, type McpServer } from './mcp.ts';
import { roleSpec } from './roles.ts';
import { chatClient } from './chat.ts';
import { threadReply } from './slack.ts';
import { openSupportCases } from './supportCase.ts';

export type Task = {
  eventId: string;
  /**
   * triage: 유저 반응 살피기, report: 아침 주기 작업 보고, support: 고객 문의 메일, reviews: 스토어 리뷰(T-11-328)(넷 다 새 글로
   * 올린다). handoff: 다른 에이전트가 넘긴 일. incident: 사건 조사(@ops, Opus. 서버 상태 감시가 연 사건은 새 글, 경보에서 넘어온
   * 사건은 그 스레드). verify: 배포 뒤 30 · 60분 지표 비교(@ops, 작업 카드 알람). followup: 문의 작업이 배포되거나
   * "고칠 것 없음"으로 끝났을 때 그 문의에 답장 초안 만들기(@plan, T-11-400).
   */
  kind:
    | 'alert'
    | 'mention'
    | 'reply'
    | 'triage'
    | 'report'
    | 'support'
    | 'reviews'
    | 'handoff'
    | 'incident'
    | 'verify'
    | 'followup';
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
  /** handoff: 넘겨준 일의 결과를 돌려받은 것(다시 돌려주지 않는다). */
  back?: boolean;
  /** verify: 마지막(60분) 확인. 끝나면 주장에게 결과를 넘긴다. */
  final?: boolean;
  /** followup: 답장을 만들 수 있는 문의 메일 스레드(Gmail threadId). */
  mail?: string;
};

/** owner: 이 역할이 연 스레드인지. 넘겨받기만 한 스레드에선 운영자 답글을 받지 않는다(한 답글에 두 봇이 답하지 않게). */
type State = { history: Message[]; costUsd: number; runs: number; owner?: boolean };

/** 이어지는 지시에 넘길 대화(사람 지시 · 에이전트 답만, 도구 기록은 뺀다). */
const HISTORY = 12;
/** 반응 살피기에서 검토할 글이 없을 때 @plan이 쓰는 한 줄(roles/plan.md). */
export const NOTHING = '검토할 반응 없음';

const isNewPost = (t: Task) =>
  t.kind === 'triage' ||
  t.kind === 'report' ||
  t.kind === 'support' ||
  t.kind === 'reviews' ||
  (t.kind === 'incident' && !t.threadTs);

export const threadOf = (env: Env, role: Role, channel: string, threadTs: string) =>
  env.THREAD.get(env.THREAD.idFromName(`${role}:${channel}:${threadTs}`));

export class AgentThread extends DurableObject<Env> {
  /** 지금 돌고 있는 일의 시작 시각(이 isolate 안). 멈춤이 이보다 뒤면 그 일을 끊는다. */
  private busySince: number | undefined;

  /**
   * 운영자 멈춤(stop.ts). 기다리는 일을 비우고, 돌고 있는 일은 다음 턴 전에 끝내게 한다.
   * 멈춘 뒤에 새로 들어온 일은 그대로 돈다(멈춘 시각보다 늦게 시작하니까).
   */
  async stop(now = Date.now()): Promise<{ cleared: number; running: boolean }> {
    const s = this.ctx.storage;
    const cleared = ((await s.get<Task[]>('queue')) ?? []).length;
    await s.put('queue', []);
    await s.put('stopAt', now);
    return { cleared, running: this.busySince !== undefined };
  }

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
      this.busySince = Date.now();
      await this.handle(task, this.busySince)
        .catch((e: unknown) => console.error('agent task failed', task.role, String(e)))
        .finally(() => (this.busySince = undefined));
    }
  }

  private async handle(task: Task, startedAt: number) {
    const env = this.env;
    const slack = chatClient(env, task.role);
    const book = ledger(env);
    // 운영자가 끼어든 횟수(주간 회고, T-11-325).
    if (task.kind === 'mention' || task.kind === 'reply') await book.touch();
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
      owner: task.kind !== 'handoff' && task.kind !== 'followup',
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
        shouldStop: async () => ((await this.ctx.storage.get<number>('stopAt')) ?? 0) >= startedAt,
      });
      const day = await book.add(task.role, r.costUsd);
      if (!isNewPost(task))
        await cardOf(env, task.channel, task.threadTs)
          .addCost(task.role, r.costUsd)
          .catch((e: unknown) => console.error('card cost failed', String(e).slice(0, 200)));
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
      if (r.stopped === 'operator') {
        // 운영자가 멈췄다: 지금까지 쓴 글만 남기고 카드 · 넘기기 · 사건 후속은 하지 않는다.
        await slack(
          'chat.postMessage',
          threadReply(
            task.channel,
            isNewPost(task) ? undefined : task.threadTs,
            `${r.text ? `${linkRoles(env, r.text)}\n\n` : ''}_운영자 지시로 여기서 멈췄어요._`,
            `${MODEL_LABEL[spec.model]} · ${r.turns}턴 · $${r.costUsd.toFixed(3)}`,
          ),
        );
        if (task.sourceTs)
          await slack('reactions.remove', {
            channel: task.channel,
            timestamp: task.sourceTs,
            name: 'eyes',
          });
        return;
      }
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
      threadReply(
        task.channel,
        isNewPost(task) ? undefined : task.threadTs,
        alertOperator(env, task, linkRoles(env, reply)),
        footer,
      ),
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
    await this.follow(task, threadTs, reply);
    await this.passOn(task, threadTs, posted.ts ?? threadTs, reply);
  }

  /** T-11-325 사건 · 배포 뒤 확인의 다음 걸음. 넘기기 줄과 달리 Worker가 정해서 넘긴다(넘기기 횟수에 세지 않는다). */
  private async follow(task: Task, threadTs: string, reply: string) {
    const env = this.env;
    // T-11-400 문의 정리가 남긴 작업 후보는 정리 글이 올라간 뒤 스레드 · 카드 · 시작 카드로 만든다.
    if (task.kind === 'support') await openSupportCases(env, task.eventId, task.channel, threadTs);
    // 경보 첫 정리(Haiku)가 사건이라고 보면 같은 스레드에서 Opus로 다시 본다.
    if (task.kind === 'alert' && isIncident(reply))
      await threadOf(env, 'ops', task.channel, threadTs).enqueue({
        eventId: `incident:${threadTs}`,
        kind: 'incident',
        role: 'ops',
        channel: task.channel,
        threadTs,
        sourceTs: '',
        text: task.text,
      });
    // 사건은 카드를 연다(담당 @ops, 조사). 경보 스레드에서 넘어온 사건도 같다.
    if (task.kind === 'incident')
      await cardOf(env, task.channel, threadTs).open({
        channel: task.channel,
        threadTs,
        goal: firstLine(reply) || '서버 사건 조사',
        source: 'incident',
        owner: 'ops',
        status: '조사',
      });
    // 마지막 배포 뒤 확인이 끝나면 주장이 카드를 닫거나 되돌리기를 정한다(돌려받은 일이라 다시 돌려주지 않는다).
    if (task.kind === 'verify' && task.final && enabled(env, 'plan'))
      await threadOf(env, 'plan', task.channel, threadTs).enqueue({
        eventId: `verify-done:${threadTs}:${task.eventId}`,
        kind: 'handoff',
        role: 'plan',
        channel: task.channel,
        threadTs,
        sourceTs: '',
        text: '배포 뒤 마지막 확인 결과예요. 좋아졌으면 card_update로 카드를 닫아 주세요(메모에 전후 수치 한 줄). 그대로거나 나빠졌으면 되돌리기 · 추가 수정 work_order를 내거나 운영자에게 물어 주세요.',
        from: 'ops',
        context: reply,
        back: true,
      });
  }

  /** 답의 `→ @역할:` 줄대로 같은 스레드에서 다른 에이전트에게 넘긴다. 스레드마다 MAX_HOPS번까지. */
  private async passOn(task: Task, threadTs: string, replyTs: string, reply: string) {
    const env = this.env;
    const handoffs = parseHandoffs(reply, task.role);
    // T-11-325: 넘겨받은 결과를 넘긴 역할에게 자동으로 돌려주지 않는다(같은 결론을 한 번 더 정리하는 호출이 생겼다).
    // 다시 맡길 일이 있으면 답에 `→ @역할:` 줄을 쓴다. 주장의 배포 뒤 확인만 예외다(위 verify).
    for (const h of handoffs) {
      if (!enabled(env, h.to)) continue;
      const n = await ledger(env).hop(`${task.channel}:${threadTs}`);
      if (n > MAX_HOPS) {
        await chatClient(env, task.role)(
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
        ...(h.back ? { back: true } : {}),
      });
    }
  }
}

/** 사건 조사 글은 운영자를 멘션해 휴대폰 알림이 가게 한다(밤에 #agent-desk 글을 놓치지 않게). */
export const alertOperator = (env: Env, task: Pick<Task, 'kind'>, text: string) =>
  task.kind === 'incident' && env.OPERATOR_USER_ID ? `<@${env.OPERATOR_USER_ID}> ${text}` : text;

const firstLine = (s: string) =>
  (s.split('\n').find((l) => l.trim()) ?? '')
    .replace(/[*#>`]/g, '')
    .replace(/^\s*사건\s*[:：]\s*/, '')
    .trim()
    .slice(0, 120);

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
