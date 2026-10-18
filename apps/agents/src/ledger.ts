// 역할별 하루 사용액(KST 날짜). 한도를 넘으면 그날은 새 작업을 받지 않는다(ADR-015 비용 통제).
import { DurableObject } from 'cloudflare:workers';
import type { Env, Role } from './env.ts';
import type { Cursors, DcCursor, Reaction } from './reactions.ts';
import type { MailDraft } from './support.ts';
import type { ReviewDraft } from './reviews.ts';
import type { CardSummary } from './card.ts';
import type { Risk } from './risk.ts';
import type { ThreadsToken } from './social.ts';

export const kstDay = (now = Date.now()) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

const ALERT_REPEAT_MS = 24 * 3600_000;
const DC_PENDING_MAX = 200;

/** 경보 서명: 숫자를 지워 용량 · 남은 일수만 바뀐 재안내를 같은 경보로 본다. */
export const alertSignature = (text: string) =>
  text
    .replace(/[\d.,]+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

type Day = { costUsd: number; tasks: number; warned?: boolean };

export type DevJob = {
  channel: string;
  threadTs: string;
  pr: number;
  title: string;
  /** T-11-325 실제 바뀐 경로로 판정한 위험도와, 시작할 때 예상한 위험도(운영자가 직접 맡긴 일이면 operator). */
  risk?: Risk;
  expected?: Risk | 'operator';
};
export type Approval = {
  /** 운영 배포 승인(T-11-312)은 0. */
  pr: number;
  sha: string;
  action: 'merge' | 'reject' | 'deploy' | 'preflight' | 'deploy_reject';
  user: string;
  at: number;
  result: string;
};

export type MailApproval = {
  draft: string;
  action: 'send' | 'discard';
  user: string;
  at: number;
  result: string;
};

/**
 * T-11-325 고치기 작업 명세. 주장(@plan)의 work_order나 운영자의 start_work가 남긴다. PR 뒤 실제 경로로 다시 판정한
 * 위험도와 견줄 때 쓴다. by가 operator면 운영자가 직접 맡긴 일이라 위험도 경고를 붙이지 않는다.
 */
export type WorkOrder = {
  id: string;
  title: string;
  request: string;
  /** 결과를 올릴 스레드(channel:ts). */
  thread: string;
  risk: Risk;
  by: 'plan' | 'operator';
  at: number;
  started?: boolean;
};

/** 승인 대기 카드(승인 묶음 · 대기 시간 측정). ts는 #agent-approvals 카드 메시지 ts. */
export type PendingApproval = { ts: string; channel: string; label: string; at: number };

/** 서버 상태 감시(7단계): 이어진 나쁜 칸 수 · 읽기 실패 수 · 마지막으로 본 칸. */
export type WatchState = { bad: number; fail: number; lastAt?: string };

const CARD_KEEP_MS = 35 * 24 * 3600_000;
const PENDING_KEEP_MS = 3 * 24 * 3600_000;
const INCIDENT_COOLDOWN_MS = 6 * 3600_000;
const WAITS_MAX = 200;

/** T-11-332 스레드를 넘어 기억할 것: 닫힌 작업 카드의 결론, 운영자가 정한 결정. */
export type Memory = {
  at: number;
  kind: 'card' | 'decision';
  role: Role;
  text: string;
  channel: string;
  threadTs: string;
};
const MEMORY_MAX = 500;
const MEMORY_TEXT_MAX = 400;

/** 질문 낱말이 많이 든 기억부터, 같으면 최근 것부터. 낱말이 없으면 최근 것. */
export function rankMemories(all: Memory[], query: string, limit: number): Memory[] {
  const terms = query
    .toLowerCase()
    .split(/[\s,.·/()]+/)
    .filter((t) => t.length >= 2);
  const scored = all.map((m) => {
    const text = m.text.toLowerCase();
    return { m, score: terms.filter((t) => text.includes(t)).length };
  });
  return scored
    .filter((x) => !terms.length || x.score > 0)
    .sort((a, b) => b.score - a.score || b.m.at - a.m.at)
    .slice(0, limit)
    .map((x) => x.m);
}

export class AgentLedger extends DurableObject<Env> {
  async day(role: Role, day = kstDay()): Promise<Day> {
    return (await this.ctx.storage.get<Day>(`${role}:${day}`)) ?? { costUsd: 0, tasks: 0 };
  }
  async add(role: Role, costUsd: number, day = kstDay()): Promise<Day> {
    const d = await this.day(role, day);
    const next = { ...d, costUsd: d.costUsd + costUsd, tasks: d.tasks + 1 };
    await this.ctx.storage.put(`${role}:${day}`, next);
    return next;
  }
  /** 같은 경보(숫자만 다른 6시간 재안내 포함)를 24시간 안에 다시 정리하지 않는다. 처음이면 true. */
  async freshAlert(signature: string, now = Date.now()): Promise<boolean> {
    const key = `alert:${signature}`;
    const at = await this.ctx.storage.get<number>(key);
    if (at && now - at < ALERT_REPEAT_MS) return false;
    await this.ctx.storage.put(key, now);
    return true;
  }
  /** 유저 반응 살피기 커서(댓글 · 채팅을 어디까지 읽었는지). */
  async cursors(): Promise<Cursors> {
    return (await this.ctx.storage.get<Cursors>('reactions:cursors')) ?? {};
  }
  async setCursors(c: Cursors): Promise<void> {
    await this.ctx.storage.put('reactions:cursors', c);
  }
  /** 디시: Actions가 읽은 데까지(커서)와 아직 정리하지 않은 글. */
  async dcCursor(): Promise<DcCursor | undefined> {
    return this.ctx.storage.get<DcCursor>('reactions:dc');
  }
  async pushDc(items: Reaction[], cursor: DcCursor): Promise<number> {
    const pending = [
      ...((await this.ctx.storage.get<Reaction[]>('reactions:dc-pending')) ?? []),
      ...items,
    ];
    // 정리가 오래 밀려도 쌓인 글이 끝없이 늘지 않게 최근 것만 둔다.
    const kept = pending.slice(-DC_PENDING_MAX);
    await this.ctx.storage.put({ 'reactions:dc': cursor, 'reactions:dc-pending': kept });
    return kept.length;
  }
  async takeDc(peek = false): Promise<Reaction[]> {
    const pending = (await this.ctx.storage.get<Reaction[]>('reactions:dc-pending')) ?? [];
    if (!peek && pending.length) await this.ctx.storage.delete('reactions:dc-pending');
    return pending;
  }
  /** 스레드 하나에서 넘기기 횟수를 하나 올리고 올린 값을 돌려준다(MAX_HOPS 상한). */
  async hop(thread: string): Promise<number> {
    const key = `hops:${thread}`;
    const n = ((await this.ctx.storage.get<number>(key)) ?? 0) + 1;
    await this.ctx.storage.put(key, n);
    return n;
  }
  /** @dev 작업(브랜치 agent-dev/<run>)을 어느 스레드 · PR에 이었는지. CI 결과 · 승인 카드에 쓴다. */
  async devJob(branch: string): Promise<DevJob | undefined> {
    return this.ctx.storage.get<DevJob>(`dev:${branch}`);
  }
  async setDevJob(branch: string, job: DevJob): Promise<void> {
    await this.ctx.storage.put(`dev:${branch}`, job);
  }
  /** 승인 · 거절 기록(누가 · 언제 · 무엇을). ADR-015 승인 단계. */
  async recordApproval(a: Approval): Promise<void> {
    await this.ctx.storage.put(`approval:${a.pr}:${a.at}`, a);
  }
  /** T-11-312 같은 main 커밋을 같은 모드로 두 번 띄우지 않는다. 처음이면 true. */
  async claimDeploy(sha: string, mode: string): Promise<boolean> {
    const key = `deploy:${sha}:${mode}`;
    if (await this.ctx.storage.get(key)) return false;
    await this.ctx.storage.put(key, Date.now());
    return true;
  }
  /** 고객 문의: 문의 메일함을 어디까지 읽었는지(epoch ms) · 만든 답장 초안 · 승인 기록(T-11-291). */
  async supportCursor(): Promise<number | undefined> {
    return this.ctx.storage.get<number>('support:cursor');
  }
  async setSupportCursor(at: number): Promise<void> {
    await this.ctx.storage.put('support:cursor', at);
  }
  async mailDraft(id: string): Promise<MailDraft | undefined> {
    return this.ctx.storage.get<MailDraft>(`maildraft:${id}`);
  }
  async setMailDraft(d: MailDraft): Promise<void> {
    await this.ctx.storage.put(`maildraft:${d.draftId}`, d);
  }
  async recordMailApproval(a: MailApproval): Promise<void> {
    await this.ctx.storage.put(`mailapproval:${a.draft}:${a.at}`, a);
  }
  /** 스토어 리뷰: 어디까지 읽었는지(리뷰 시각 epoch ms) · 답글 초안 · 승인 기록(T-11-328). */
  async reviewsCursor(): Promise<number | undefined> {
    return this.ctx.storage.get<number>('reviews:cursor');
  }
  async setReviewsCursor(at: number): Promise<void> {
    await this.ctx.storage.put('reviews:cursor', at);
  }
  async reviewDraft(id: string): Promise<ReviewDraft | undefined> {
    return this.ctx.storage.get<ReviewDraft>(`reviewdraft:${id}`);
  }
  async setReviewDraft(d: ReviewDraft): Promise<void> {
    await this.ctx.storage.put(`reviewdraft:${d.id}`, d);
  }
  async recordReviewApproval(a: MailApproval): Promise<void> {
    await this.ctx.storage.put(`reviewapproval:${a.draft}:${a.at}`, a);
  }
  /** T-11-325 작업 카드 요약. 닫힌 지 35일 넘은 카드는 목록에서 지운다. */
  async trackCard(key: string, s: CardSummary): Promise<void> {
    await this.ctx.storage.put(`card:${key}`, s);
  }
  async cards(now = Date.now()): Promise<CardSummary[]> {
    const all = await this.ctx.storage.list<CardSummary>({ prefix: 'card:' });
    const out: CardSummary[] = [];
    const old: string[] = [];
    for (const [k, v] of all) {
      if (v.closedAt && now - v.closedAt > CARD_KEEP_MS) old.push(k);
      else out.push(v);
    }
    if (old.length) await this.ctx.storage.delete(old);
    return out;
  }
  async order(id: string): Promise<WorkOrder | undefined> {
    return this.ctx.storage.get<WorkOrder>(`order:${id}`);
  }
  /** 스레드에 걸린 가장 최근 작업 명세. */
  async orderOf(thread: string): Promise<WorkOrder | undefined> {
    const id = await this.ctx.storage.get<string>(`order-thread:${thread}`);
    return id ? this.order(id) : undefined;
  }
  async setOrder(o: WorkOrder): Promise<void> {
    await this.ctx.storage.put({ [`order:${o.id}`]: o, [`order-thread:${o.thread}`]: o.id });
  }
  /** 낮음 자동 시작 하루 횟수를 하나 올리고 올린 값을 돌려준다. */
  async autoStart(day = kstDay()): Promise<number> {
    const key = `auto:${day}`;
    const n = ((await this.ctx.storage.get<number>(key)) ?? 0) + 1;
    await this.ctx.storage.put(key, n);
    return n;
  }
  async autoStarts(day = kstDay()): Promise<number> {
    return (await this.ctx.storage.get<number>(`auto:${day}`)) ?? 0;
  }
  /** 운영자가 끼어든 횟수(멘션 · 답글 · 승인 버튼). 주간 회고에 쓴다. */
  async touch(day = kstDay()): Promise<void> {
    const key = `touch:${day}`;
    await this.ctx.storage.put(key, ((await this.ctx.storage.get<number>(key)) ?? 0) + 1);
  }
  async touches(day: string): Promise<number> {
    return (await this.ctx.storage.get<number>(`touch:${day}`)) ?? 0;
  }
  async pendingAdd(p: PendingApproval): Promise<void> {
    await this.ctx.storage.put(`pending:${p.ts}`, p);
  }
  /** 승인 카드가 눌렸다. 기다린 시간(ms)을 기록하고 돌려준다. 모르는 카드면 null. */
  async pendingDone(ts: string, now = Date.now()): Promise<number | null> {
    const p = await this.ctx.storage.get<PendingApproval>(`pending:${ts}`);
    if (!p) return null;
    await this.ctx.storage.delete(`pending:${ts}`);
    const waits = (await this.ctx.storage.get<{ at: number; ms: number }[]>('waits')) ?? [];
    await this.ctx.storage.put('waits', [...waits, { at: now, ms: now - p.at }].slice(-WAITS_MAX));
    return now - p.at;
  }
  async pending(now = Date.now()): Promise<PendingApproval[]> {
    const all = await this.ctx.storage.list<PendingApproval>({ prefix: 'pending:' });
    const out: PendingApproval[] = [];
    const old: string[] = [];
    for (const [k, v] of all) {
      if (now - v.at > PENDING_KEEP_MS) old.push(k);
      else out.push(v);
    }
    if (old.length) await this.ctx.storage.delete(old);
    return out;
  }
  async waits(): Promise<{ at: number; ms: number }[]> {
    return (await this.ctx.storage.get<{ at: number; ms: number }[]>('waits')) ?? [];
  }
  /** 승인 · 거절 기록 수(머지 · 배포 · 메일). since 뒤만. */
  async approvalCount(since: number): Promise<number> {
    let n = 0;
    for (const prefix of ['approval:', 'mailapproval:']) {
      const all = await this.ctx.storage.list<{ at: number }>({ prefix });
      for (const v of all.values()) if (v.at >= since) n++;
    }
    return n;
  }
  async watch(): Promise<WatchState> {
    return (await this.ctx.storage.get<WatchState>('watch')) ?? { bad: 0, fail: 0 };
  }
  async setWatch(w: WatchState): Promise<void> {
    await this.ctx.storage.put('watch', w);
  }
  /** 서버 상태 사건은 6시간에 한 번만 연다. 처음이면 true. */
  async claimIncident(now = Date.now()): Promise<boolean> {
    const at = await this.ctx.storage.get<number>('incident:at');
    if (at && now - at < INCIDENT_COOLDOWN_MS) return false;
    await this.ctx.storage.put('incident:at', now);
    return true;
  }
  async remember(m: Memory): Promise<void> {
    const text = m.text.replace(/\s+/g, ' ').trim().slice(0, MEMORY_TEXT_MAX);
    if (!text) return;
    await this.ctx.storage.put(`memory:${String(m.at).padStart(15, '0')}:${m.threadTs}`, {
      ...m,
      text,
    });
    const keys = [...(await this.ctx.storage.list({ prefix: 'memory:' })).keys()];
    if (keys.length > MEMORY_MAX)
      await this.ctx.storage.delete(keys.slice(0, keys.length - MEMORY_MAX));
  }
  async recall(query: string, limit = 8): Promise<Memory[]> {
    const all = [...(await this.ctx.storage.list<Memory>({ prefix: 'memory:' })).values()];
    return rankMemories(all, query, limit);
  }
  /** 한도 초과 안내는 하루 한 번만 한다. 처음이면 true. */
  /** T-11-395 Threads 장기 토큰(60일)을 갱신한 값. */
  async threadsToken(): Promise<ThreadsToken | undefined> {
    return this.ctx.storage.get<ThreadsToken>('threads:token');
  }
  async setThreadsToken(v: ThreadsToken): Promise<void> {
    await this.ctx.storage.put('threads:token', v);
  }
  async warnOnce(role: Role, day = kstDay()): Promise<boolean> {
    const d = await this.day(role, day);
    if (d.warned) return false;
    await this.ctx.storage.put(`${role}:${day}`, { ...d, warned: true });
    return true;
  }
}

export const ledger = (env: Env) => env.LEDGER.get(env.LEDGER.idFromName('ledger'));
