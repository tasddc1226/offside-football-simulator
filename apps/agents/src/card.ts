// ADR-015 5단계(T-11-325) 작업 카드. 슬랙 스레드 하나에 카드 하나(키 `<채널>:<스레드 ts>`). 역할별 AgentThread는 대화만,
// 카드는 이 객체가 맡는다. 카드는 그 스레드에 주장(@plan) 이름으로 한 번 올리고 바뀔 때마다 chat.update로 고친다.
// 판단이 필요한 상태(조사 → 수정, 확인 → 닫힘, 보류)는 주장이 card_update로, 시스템 사건(PR · 승인 · 머지 · 배포)은 Worker가 바꾼다.
import { DurableObject } from 'cloudflare:workers';
import { ROLES, type Env, type Role } from './env.ts';
import { ledger } from './ledger.ts';
import { RISK_LABEL, type Risk } from './risk.ts';
import { chatClient } from './chat.ts';
import { threadReply } from './slack.ts';
import { threadOf } from './thread.ts';

export const STATUSES = [
  '접수',
  '조사',
  '수정',
  '승인 대기',
  '배포',
  '확인 중',
  '닫힘',
  '보류',
] as const;
export type CardStatus = (typeof STATUSES)[number];
export const isStatus = (v: unknown): v is CardStatus => STATUSES.includes(v as CardStatus);

export type CardSource = 'operator' | 'alert' | 'incident' | 'support' | 'reactions' | 'deploy';
const SOURCE_LABEL: Record<CardSource, string> = {
  operator: '운영자',
  alert: '경보',
  incident: '사건',
  support: '문의',
  reactions: '유저 반응',
  deploy: '배포',
};

/** 배포 뒤 확인(분). 운영 배포가 성공하면 사건 카드에 이 간격으로 @ops 확인을 예약한다. */
export const CHECK_MINUTES = [30, 60] as const;
const MAX_LINKS = 10;

export type Card = {
  channel: string;
  threadTs: string;
  goal: string;
  source: CardSource;
  owner: Role;
  risk?: Risk;
  status: CardStatus;
  next?: { at: number; what: string };
  links: string[];
  cost: Partial<Record<Role, number>>;
  openedAt: number;
  updatedAt: number;
  closedAt?: number;
  /** 스레드에 올린 카드 메시지 ts와 올린 봇(고칠 때 같은 봇이어야 한다). */
  messageTs?: string;
  poster?: Role;
  /** 배포 뒤 확인 예약: 배포한 커밋과 남은 확인 시각(ms). */
  checks?: { sha: string; due: number[] };
  note?: string;
};

export type CardInit = Pick<Card, 'channel' | 'threadTs' | 'goal' | 'source' | 'owner'> &
  Partial<Pick<Card, 'risk' | 'status'>>;
export type CardPatch = Partial<Pick<Card, 'goal' | 'owner' | 'risk' | 'status' | 'note'>> & {
  /** null이면 다음 확인을 지운다. */
  next?: { at: number; what: string } | null;
  link?: string;
};

/** 주간 회고 · 아침 목록에 쓰는 요약(AgentLedger에 둔다). */
export type CardSummary = Pick<
  Card,
  'channel' | 'threadTs' | 'goal' | 'status' | 'owner' | 'source' | 'openedAt' | 'updatedAt'
> & { closedAt?: number; costUsd: number; next?: Card['next'] };

export const cardKey = (channel: string, threadTs: string) => `${channel}:${threadTs}`;
export const cardOf = (env: Env, channel: string, threadTs: string) =>
  env.CARD.get(env.CARD.idFromName(cardKey(channel, threadTs)));

const clipLine = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);

export function newCard(init: CardInit, now = Date.now()): Card {
  return {
    channel: init.channel,
    threadTs: init.threadTs,
    goal: clipLine(init.goal, 200) || '목표 미정',
    source: init.source,
    owner: init.owner,
    ...(init.risk ? { risk: init.risk } : {}),
    status: init.status ?? '접수',
    links: [],
    cost: {},
    openedAt: now,
    updatedAt: now,
  };
}

export function applyPatch(card: Card, p: CardPatch, now = Date.now()): Card {
  const next: Card = { ...card, links: [...card.links], updatedAt: now };
  if (p.goal) next.goal = clipLine(p.goal, 200);
  if (p.owner) next.owner = p.owner;
  if (p.risk) next.risk = p.risk;
  if (p.note !== undefined) {
    const note = clipLine(p.note, 300);
    if (note) next.note = note;
    else delete next.note;
  }
  if (p.next === null) delete next.next;
  else if (p.next) next.next = { at: p.next.at, what: clipLine(p.next.what, 160) };
  if (p.link && !next.links.includes(p.link))
    next.links = [...next.links, p.link].slice(-MAX_LINKS);
  if (p.status && p.status !== card.status) {
    next.status = p.status;
    if (p.status === '닫힘') {
      next.closedAt = now;
      delete next.next;
      delete next.checks;
    } else delete next.closedAt;
  }
  return next;
}

export const cardCost = (c: Pick<Card, 'cost'>) =>
  Object.values(c.cost).reduce((a, b) => a + (b ?? 0), 0);

export function summaryOf(c: Card): CardSummary {
  return {
    channel: c.channel,
    threadTs: c.threadTs,
    goal: c.goal,
    status: c.status,
    owner: c.owner,
    source: c.source,
    openedAt: c.openedAt,
    updatedAt: c.updatedAt,
    ...(c.closedAt ? { closedAt: c.closedAt } : {}),
    ...(c.next ? { next: c.next } : {}),
    costUsd: cardCost(c),
  };
}

export const kstClock = (ms: number) =>
  new Date(ms + 9 * 3600_000).toISOString().replace('T', ' ').slice(5, 16);

/** 스레드에 올리는 카드 본문(mrkdwn). */
export function renderCard(c: Card): string {
  const costs = ROLES.filter((r) => c.cost[r])
    .map((r) => `${r} $${c.cost[r]!.toFixed(2)}`)
    .join(' · ');
  return [
    `*작업 카드* · ${c.status}`,
    `• 목표: ${c.goal}`,
    `• 출처: ${SOURCE_LABEL[c.source]} · 담당: @${c.owner}${c.risk ? ` · 위험도: ${RISK_LABEL[c.risk]}` : ''}`,
    ...(c.next ? [`• 다음 확인: ${kstClock(c.next.at)} KST · ${c.next.what}`] : []),
    ...(c.links.length ? [`• 연결: ${c.links.join(' · ')}`] : []),
    ...(c.note ? [`• 메모: ${c.note}`] : []),
    `• 비용: ${costs ? `${costs} (합 $${cardCost(c).toFixed(2)})` : '아직 없음'} · 연 시각 ${kstClock(c.openedAt)} KST`,
  ].join('\n');
}

const roleSlack = (env: Env, role: Role) => chatClient(env, role);

export class WorkCard extends DurableObject<Env> {
  async get(): Promise<Card | undefined> {
    return this.ctx.storage.get<Card>('card');
  }

  /** 카드를 연다. 이미 있으면 그대로 돌려준다(닫힌 카드는 다시 연다). */
  async open(init: CardInit): Promise<Card> {
    const had = await this.get();
    if (had && had.status !== '닫힘') return had;
    const card = had
      ? applyPatch(had, { status: init.status ?? '접수', goal: init.goal, owner: init.owner })
      : newCard(init);
    return this.save(card);
  }

  /** 카드가 없으면 아무것도 하지 않고 undefined. */
  async patch(p: CardPatch): Promise<Card | undefined> {
    const card = await this.get();
    if (!card) return undefined;
    return this.save(applyPatch(card, p));
  }

  async addCost(role: Role, usd: number): Promise<void> {
    const card = await this.get();
    if (!card || !(usd > 0)) return;
    card.cost = { ...card.cost, [role]: (card.cost[role] ?? 0) + usd };
    await this.save(card, false);
  }

  /** 운영 배포가 성공한 사건 카드: 30 · 60분 뒤 @ops 확인을 예약한다. */
  async scheduleChecks(sha: string, now = Date.now()): Promise<Card | undefined> {
    const card = await this.get();
    if (!card) return undefined;
    const due = CHECK_MINUTES.map((m) => now + m * 60_000);
    const next = applyPatch(card, {
      status: '확인 중',
      link: `\`${sha.slice(0, 7)}\``,
      next: { at: due[0]!, what: `배포 뒤 ${CHECK_MINUTES[0]}분 지표 비교(@ops)` },
    });
    next.checks = { sha, due };
    await this.ctx.storage.setAlarm(due[0]!);
    return this.save(next);
  }

  override async alarm() {
    const card = await this.get();
    if (!card?.checks?.due.length) return;
    const rest = card.checks.due.slice(1);
    const index = Math.max(0, CHECK_MINUTES.length - card.checks.due.length);
    const after = CHECK_MINUTES[index]!;
    const final = rest.length === 0;
    await threadOf(this.env, 'ops', card.channel, card.threadTs).enqueue({
      eventId: `verify:${card.checks.sha}:${after}`,
      kind: 'verify',
      role: 'ops',
      channel: card.channel,
      threadTs: card.threadTs,
      sourceTs: '',
      text: `운영 배포 \`${card.checks.sha.slice(0, 7)}\` 뒤 ${after}분 확인이에요. 이 사건을 조사할 때 본 지표를 같은 방법 · 같은 길이의 시간 범위로 다시 재서 배포 전후 표로 정리해 주세요.${final ? ' 마지막 확인이에요. 좋아졌는지 · 그대로인지 · 나빠졌는지 결론을 한 줄로 써 주세요.' : ''}`,
      ...(final ? { final: true } : {}),
    });
    const next = applyPatch(card, {
      next: rest.length
        ? { at: rest[0]!, what: `배포 뒤 ${CHECK_MINUTES[index + 1]}분 지표 비교(@ops)` }
        : null,
    });
    if (rest.length) next.checks = { sha: card.checks.sha, due: rest };
    else delete next.checks;
    await this.save(next);
    if (rest.length) await this.ctx.storage.setAlarm(rest[0]!);
  }

  /** 저장하고 장부 요약을 고친다. post면 스레드의 카드 메시지를 올리거나 고친다. */
  private async save(card: Card, post = true): Promise<Card> {
    if (post) {
      try {
        const text = renderCard(card);
        const blocks = [{ type: 'section', text: { type: 'mrkdwn', text } }];
        if (card.messageTs)
          await roleSlack(this.env, card.poster ?? 'plan')('chat.update', {
            channel: card.channel,
            ts: card.messageTs,
            text,
            blocks,
          });
        else
          // 주장 봇이 없는 채널(#offside-alerts 등)이면 담당 봇으로 올린다.
          for (const role of [...new Set<Role>(['plan', card.owner])]) {
            const posted = await roleSlack(this.env, role)('chat.postMessage', {
              ...threadReply(card.channel, card.threadTs, text),
              blocks,
            });
            if (posted.ts) {
              card.messageTs = posted.ts;
              card.poster = role;
              break;
            }
          }
      } catch (e) {
        console.error('card post failed', String(e).slice(0, 200));
      }
    }
    const prev = await this.ctx.storage.get<Card>('card');
    // T-11-332 닫히거나 보류된 카드의 결론은 다른 스레드에서도 찾을 수 있게 남긴다(recall).
    if ((card.status === '닫힘' || card.status === '보류') && prev?.status !== card.status)
      await ledger(this.env).remember({
        at: card.updatedAt,
        kind: 'card',
        role: card.owner,
        text: `[${card.status}] ${card.goal}${card.note ? ` → ${card.note}` : ''}`,
        channel: card.channel,
        threadTs: card.threadTs,
      });
    await this.ctx.storage.put('card', card);
    await ledger(this.env).trackCard(cardKey(card.channel, card.threadTs), summaryOf(card));
    return card;
  }
}
