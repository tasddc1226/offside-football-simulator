import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNoFix } from './dev.ts';
import type { Env } from './env.ts';
import type { WorkOrder } from './ledger.ts';
import type { Gmail, RawMessage } from './support.ts';
import { supportTools } from './support.ts';
import {
  MAX_CASES,
  openSupportCases,
  supportCaseTools,
  supportFollowup,
  type SupportCase,
} from './supportCase.ts';
import { afterDeploy } from './team.ts';
import type { Task } from './thread.ts';
import { fakeChat } from './testChat.ts';

afterEach(() => vi.unstubAllGlobals());

const task = (p: Partial<Task>): Task => ({
  eventId: 'support:1',
  kind: 'support',
  role: 'plan',
  channel: 'CDESK',
  threadTs: '',
  sourceTs: '',
  text: '',
  ...p,
});

/** 원장 · 카드 · 스레드 DO와 Slack을 흉내 낸다. */
function setup(batch: string[] = ['t-1'], cases: SupportCase[] = []) {
  const store = { batch, cases: [...cases], orders: [] as WorkOrder[], pending: 0 };
  const cardCalls: [string, string, unknown][] = [];
  const queued: Task[] = [];
  const posts: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    posts.push(body);
    return new Response(JSON.stringify({ ok: true, ts: `${posts.length}.0` }));
  });
  const env = {
    ENABLED_ROLES: 'plan,dev',
    DISCORD: fakeChat,
    APPROVAL_CHANNEL: 'CAPPROVE',
    LEDGER: {
      idFromName: () => 'id',
      get: () => ({
        supportBatch: async () => store.batch,
        addCase: async (_e: string, c: SupportCase) => void store.cases.push(c),
        takeCases: async () => store.cases.splice(0),
        setOrder: async (o: WorkOrder) => void store.orders.push(o),
        orderOf: async (thread: string) => store.orders.find((o) => o.thread === thread),
        pendingAdd: async () => void store.pending++,
        cards: async () => [],
      }),
    },
    CARD: {
      idFromName: (k: string) => k,
      get: (k: string) => ({
        open: async (p: unknown) => void cardCalls.push([k, 'open', p]),
        patch: async (p: unknown) => void cardCalls.push([k, 'patch', p]),
      }),
    },
    THREAD: {
      idFromName: (k: string) => k,
      get: () => ({ enqueue: async (t: Task) => (queued.push(t), 'queued') }),
    },
  } as unknown as Env;
  return { env, store, cardCalls, queued, posts };
}

const kase = (p: Partial<SupportCase> = {}): SupportCase => ({
  title: '타겟맨 훈련 안내',
  goal: '타겟맨인데 훈련 안내가 스트라이커 기준으로 보여요',
  repro: '웹 · 훈련 화면',
  scope: ['packages/game/src/training.ts'],
  done: '두 역할 가중치가 함께 보임',
  risk: 'mid',
  mail: 't-1',
  ...p,
});

describe('문의 작업 후보', () => {
  it('문의 정리에서만 쓰고, 이번 정리의 메일 스레드에만 건다', async () => {
    const { env, store } = setup();
    expect(supportCaseTools(env, task({ kind: 'mention' }))).toHaveLength(0);
    const [tool] = supportCaseTools(env, task({}));
    const input = {
      title: '훈련 안내',
      goal: '증상 someone@example.com',
      scope: ['packages/game/src/save.ts'],
      done: '완료',
    };
    expect(await tool!.run({ ...input, thread_id: 't-9' })).toContain(
      '문의 메일 스레드가 아니에요',
    );
    expect(await tool!.run({ ...input, thread_id: 't-1', risk_guess: 'low' })).toContain('높음');
    // 범위가 세이브 파일이라 위험도는 높음으로 오르고, 메일 주소는 가린다.
    expect(store.cases[0]).toMatchObject({
      mail: 't-1',
      risk: 'high',
      goal: '증상 (메일 주소 가림)',
    });
    for (let i = 1; i < MAX_CASES; i++) await tool!.run({ ...input, thread_id: 't-1' });
    expect(await tool!.run({ ...input, thread_id: 't-1' })).toContain(`${MAX_CASES}개까지만`);
    expect(store.cases).toHaveLength(MAX_CASES);
  });

  it('정리 글 뒤 후보마다 스레드 · 카드 · 시작 카드를 만들고, 높음은 보류로 둔다', async () => {
    const { env, store, cardCalls, posts } = setup(['t-1'], [kase(), kase({ risk: 'high' })]);
    expect(await openSupportCases(env, 'support:1', 'CDESK', '9.9')).toBe(2);
    // 낮음 · 중간도 바로 시작하지 않고 시작 카드(plan_start)로 간다.
    const start = posts.find((p) => p.channel === 'CAPPROVE')!;
    expect(JSON.stringify(start.blocks)).toContain('plan_start');
    expect(JSON.stringify(start.blocks)).toContain('고객 문의에서 온 작업');
    expect(store.pending).toBe(1);
    expect(store.orders[0]).toMatchObject({ mail: 't-1', by: 'plan', thread: 'CDESK:1.0' });
    expect(cardCalls[0]![2]).toMatchObject({ source: 'support', status: '승인 대기' });
    // 높음: 시작 카드 없이 보류, 명세는 남겨 운영자가 @dev에게 맡기면 메일 연결이 이어진다.
    expect(posts.filter((p) => p.channel === 'CAPPROVE')).toHaveLength(1);
    expect(cardCalls.find((c) => (c[2] as { status?: string }).status === '보류')).toBeTruthy();
    expect(store.orders[1]).toMatchObject({ mail: 't-1', started: false });
    expect(store.cases).toHaveLength(0);
  });

  it('@dev가 고칠 것 없음으로 판정한 답을 알아본다', () => {
    expect(isNoFix('판정: 고칠 것 없음\n원래 규칙이에요')).toBe(true);
    expect(isNoFix('\n**판정: 고칠 것 없음**')).toBe(true);
    expect(isNoFix('판정: 버그\n고칠 것 없음은 아니에요')).toBe(false);
  });

  it('배포된 문의 작업 카드는 닫고 그 스레드에 마무리 답장을 맡긴다', async () => {
    const { env, store, queued } = setup();
    store.orders.push({
      id: 'o',
      title: '타겟맨',
      request: '',
      thread: 'C1:1.1',
      risk: 'mid',
      by: 'plan',
      at: 0,
      mail: 't-1',
    });
    const ledgerGet = env.LEDGER.get as unknown as () => Record<string, unknown>;
    const base = ledgerGet();
    (env as unknown as { LEDGER: unknown }).LEDGER = {
      idFromName: () => 'id',
      get: () => ({
        ...base,
        cards: async () => [
          {
            channel: 'C1',
            threadTs: '1.1',
            goal: '타겟맨',
            status: '배포',
            owner: 'dev',
            source: 'support',
            openedAt: 0,
            updatedAt: 0,
            costUsd: 0,
          },
        ],
      }),
    };
    expect(await afterDeploy(env, 'b'.repeat(40))).toEqual({ checks: 0, closed: 1, replies: 1 });
    expect(queued[0]).toMatchObject({
      kind: 'followup',
      role: 'plan',
      threadTs: '1.1',
      mail: 't-1',
    });
    expect(queued[0]!.text).toContain('bbbbbbb');
  });

  it('메일이 없는 작업이나 @plan이 꺼져 있으면 맡기지 않는다', async () => {
    const { env, queued } = setup();
    const o = { thread: 'C1:1.1', title: 't' };
    expect(await supportFollowup(env, o, 'deployed', 'x')).toBe(false);
    expect(
      await supportFollowup(
        { ...env, ENABLED_ROLES: 'dev' } as Env,
        { ...o, mail: 't' },
        'deployed',
        'x',
      ),
    ).toBe(false);
    expect(queued).toHaveLength(0);
  });
});

describe('문의 마무리 답장', () => {
  const env = {
    GMAIL_CLIENT_ID: 'a',
    GMAIL_CLIENT_SECRET: 'b',
    GMAIL_REFRESH_TOKEN: 'c',
    SUPPORT_FROM: 'contact@offside-lab.com',
  } as Env;
  const msg = (id: string, sent: boolean): RawMessage => ({
    id,
    threadId: 't-1',
    internalDate: '1000',
    ...(sent ? { labelIds: ['SENT'] } : {}),
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: sent ? 'contact@offside-lab.com' : 'user@example.com' },
        { name: 'Subject', value: '훈련 문의' },
        { name: 'Message-ID', value: `<${id}@mail>` },
      ],
      body: { data: btoa('hello') },
    },
  });

  it('그 작업의 메일 스레드에만, 우리가 앞서 답한 뒤에도 초안을 만든다', async () => {
    const g = (async (path: string) => {
      if (path.startsWith('/threads/'))
        return { id: 't-1', messages: [msg('a', false), msg('b', true)] };
      throw new Error('stop');
    }) as Gmail;
    const draft = supportTools(env, task({ kind: 'followup', mail: 't-1' }), async () => g).find(
      (t) => t.name === 'support_draft',
    )!;
    await expect(draft.run({ thread_id: 't-2', body: '안녕하세요' })).rejects.toThrow(
      '이 작업의 문의 메일 스레드에만',
    );
    // 이미 답한 스레드여도 막히지 않고 초안 만들기(/drafts)까지 간다.
    await expect(draft.run({ thread_id: 't-1', body: '안녕하세요' })).rejects.toThrow('stop');
    const plain = supportTools(env, task({ kind: 'mention' }), async () => g).find(
      (t) => t.name === 'support_draft',
    )!;
    await expect(plain.run({ thread_id: 't-1', body: '안녕하세요' })).rejects.toThrow(
      '이미 답장했어요',
    );
  });
});
