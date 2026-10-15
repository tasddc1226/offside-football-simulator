// 역할별 하루 사용액(KST 날짜). 한도를 넘으면 그날은 새 작업을 받지 않는다(ADR-015 비용 통제).
import { DurableObject } from 'cloudflare:workers';
import type { Env, Role } from './env.ts';
import type { Cursors, DcCursor, Reaction } from './reactions.ts';

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

export type DevJob = { channel: string; threadTs: string; pr: number; title: string };
export type Approval = {
  pr: number;
  sha: string;
  action: 'merge' | 'reject';
  user: string;
  at: number;
  result: string;
};

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
  /** 한도 초과 안내는 하루 한 번만 한다. 처음이면 true. */
  async warnOnce(role: Role, day = kstDay()): Promise<boolean> {
    const d = await this.day(role, day);
    if (d.warned) return false;
    await this.ctx.storage.put(`${role}:${day}`, { ...d, warned: true });
    return true;
  }
}

export const ledger = (env: Env) => env.LEDGER.get(env.LEDGER.idFromName('ledger'));
