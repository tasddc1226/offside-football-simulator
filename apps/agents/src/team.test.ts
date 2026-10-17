// T-11-325 ADR-015 5~7단계: 위험도 · 작업 카드 · 주장 도구 · 정기 글 · 서버 상태 감시.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPatch, newCard, renderCard, summaryOf, type Card, type CardSummary } from './card.ts';
import { AUTO_LIMIT, captainTools, orderRequest, startInteraction } from './captain.ts';
import { riskLines } from './dev.ts';
import type { Env } from './env.ts';
import { isIncident } from './handoff.ts';
import { decide } from './index.ts';
import type { WatchState, WorkOrder } from './ledger.ts';
import { riskOf, riskOfPath } from './risk.ts';
import { modelFor } from './roles.ts';
import {
  afterDeploy,
  bucketLevel,
  median,
  openCardsText,
  pendingText,
  retroText,
  watchStatus,
} from './team.ts';
import type { Gh } from './github.ts';
import type { Task } from './thread.ts';

afterEach(() => vi.unstubAllGlobals());

const H = 3600_000;
const NOW = Date.parse('2026-10-19T00:00:00Z'); // 월요일 09:00 KST

describe('위험도', () => {
  it('경로로 낮음 · 중간 · 높음을 정하고 여러 파일이면 가장 높은 것', () => {
    expect(riskOfPath('docs/tracking/board.md')).toBe('low');
    expect(riskOfPath('packages/app-core/src/i18n/en/home.ts')).toBe('low');
    expect(riskOfPath('apps/web/src/ui/Home.svelte')).toBe('low');
    expect(riskOfPath('apps/api/src/routes/hof.ts')).toBe('mid');
    expect(riskOfPath('packages/game/src/season.ts')).toBe('mid');
    expect(riskOfPath('apps/api/migrations/0104_x.sql')).toBe('high');
    expect(riskOfPath('packages/game/src/save.ts')).toBe('high');
    expect(riskOfPath('apps/api/wrangler.jsonc')).toBe('high');
    expect(riskOfPath('.github/workflows/ci.yml')).toBe('high');
    expect(riskOfPath('apps/agents/src/agents.test.ts')).toBe('high');
    expect(riskOfPath('apps/agents/knowledge/ops-baseline.md')).toBe('mid');
    expect(riskOf(['docs/a.md', 'apps/api/src/app.ts'])).toBe('mid');
    expect(riskOf(['docs/a.md', 'pnpm-lock.yaml'])).toBe('high');
    expect(riskOf([])).toBe('mid');
  });

  it('승인 카드는 실제 위험도가 예상보다 높을 때만 경고한다', () => {
    expect(riskLines({ risk: 'mid', expected: 'operator' })).toHaveLength(1);
    expect(riskLines({ risk: 'low', expected: 'low' })[0]).toContain('예상 낮음');
    const warn = riskLines({ risk: 'high', expected: 'low' });
    expect(warn).toHaveLength(2);
    expect(warn[1]).toContain('운영자가 직접 맡겨야');
    expect(riskLines({})).toEqual([]);
  });
});

describe('작업 카드', () => {
  const base = () =>
    newCard(
      {
        channel: 'C1',
        threadTs: '1.1',
        goal: '  시즌 업로드가\n느려요 ',
        source: 'operator',
        owner: 'plan',
      },
      NOW,
    );

  it('열고 고치고 닫는다', () => {
    const c = base();
    expect(c).toMatchObject({ goal: '시즌 업로드가 느려요', status: '접수', links: [] });
    const fixing = applyPatch(
      c,
      { status: '수정', owner: 'dev', link: 'PR #1', risk: 'low' },
      NOW + H,
    );
    expect(fixing).toMatchObject({ status: '수정', owner: 'dev', risk: 'low', links: ['PR #1'] });
    expect(applyPatch(fixing, { link: 'PR #1' }).links).toEqual(['PR #1']);
    const closed = applyPatch(
      { ...fixing, next: { at: NOW, what: 'x' } },
      { status: '닫힘', note: '끝' },
      NOW + 2 * H,
    );
    expect(closed.closedAt).toBe(NOW + 2 * H);
    expect(closed.next).toBeUndefined();
    expect(applyPatch(closed, { status: '조사' }).closedAt).toBeUndefined();
    expect(applyPatch(closed, { note: '' }).note).toBeUndefined();
  });

  it('카드 본문에 상태 · 담당 · 위험도 · 비용을 적는다', () => {
    const c: Card = {
      ...applyPatch(base(), { risk: 'mid', link: 'PR #2' }),
      cost: { ops: 0.5, dev: 1.25 },
    };
    const text = renderCard(c);
    expect(text).toContain('*작업 카드* · 접수');
    expect(text).toContain('위험도: 중간');
    expect(text).toContain('ops $0.50 · dev $1.25 (합 $1.75)');
    expect(summaryOf(c).costUsd).toBeCloseTo(1.75);
  });
});

const summary = (p: Partial<CardSummary>): CardSummary => ({
  channel: 'C1',
  threadTs: '1.1',
  goal: '목표',
  status: '조사',
  owner: 'ops',
  source: 'operator',
  openedAt: NOW - 2 * 24 * H,
  updatedAt: NOW - H,
  costUsd: 0,
  ...p,
});

describe('정기 글', () => {
  it('열린 카드 목록은 24시간 넘게 멈춘 카드를 표시하고, 열린 카드가 없으면 올리지 않는다', () => {
    expect(openCardsText([summary({ status: '닫힘', closedAt: NOW })], NOW)).toBeNull();
    const text = openCardsText(
      [
        summary({ goal: '오래됨', updatedAt: NOW - 30 * H }),
        summary({ goal: '최근', threadTs: '2.2' }),
      ],
      NOW,
    )!;
    expect(text).toContain('**열린 작업 카드 2개** · 24시간 넘게 멈춘 카드 1개(⏸)');
    expect(text.indexOf('오래됨')).toBeLessThan(text.indexOf('최근'));
    expect(text).toContain('⏸ <https://offside-lab.slack.com/archives/C1/p11|오래됨>');
  });

  it('주간 회고는 지난 7일 카드 · 리드타임 · 개입 · 비용을 센다', () => {
    const text = retroText(
      {
        cards: [
          summary({ status: '닫힘', openedAt: NOW - 10 * H, closedAt: NOW - 4 * H, costUsd: 2 }),
          summary({
            status: '닫힘',
            source: 'incident',
            openedAt: NOW - 3 * H,
            closedAt: NOW - H,
            costUsd: 1,
          }),
          summary({ updatedAt: NOW - 50 * H }),
        ],
        touches: 9,
        approvals: 4,
        waits: [H, 3 * H],
        costs: { ops: 1, plan: 2, dev: 3, mkt: 0.5 },
        autoStarts: 2,
      },
      NOW,
    );
    expect(text).toContain('새로 3 · 닫힘 2 · 24시간 넘게 멈춤 1');
    expect(text).toContain('닫힐 때까지(중앙값): 4시간');
    expect(text).toContain('사건: 1건 · 알아차림부터 닫힘까지(중앙값) 2시간');
    expect(text).toContain('멘션 · 답글 9번 · 승인 버튼 4번 · 승인 대기(중앙값) 2시간');
    expect(text).toContain('합 $6.50');
    expect(text).toContain('닫힌 카드당 $1.50');
    expect(median([])).toBeNull();
  });

  it('승인 묶음은 1시간 넘은 카드만 오래된 순으로', () => {
    expect(
      pendingText([{ ts: '9.9', channel: 'CA', label: '새것', at: NOW - 60_000 }], NOW),
    ).toBeNull();
    const text = pendingText(
      [
        { ts: '2.2', channel: 'CA', label: '배포', at: NOW - 2 * H },
        { ts: '1.1', channel: 'CA', label: '머지', at: NOW - 5 * H },
      ],
      NOW,
    )!;
    expect(text).toContain('**승인 대기 2건**');
    expect(text.indexOf('머지')).toBeLessThan(text.indexOf('배포'));
  });
});

describe('사건', () => {
  it('첫 줄이 `사건:`일 때만 사건으로 본다', () => {
    expect(isIncident('사건: 5xx가 3%예요\n…')).toBe(true);
    expect(isIncident('**사건**: 느려요')).toBe(true);
    expect(isIncident('무슨 일: 백업 지연\n사건: 아님')).toBe(false);
    expect(modelFor('incident')).toContain('opus');
    expect(modelFor('verify')).toContain('sonnet');
  });

  it('5분 칸 판정은 화면과 같은 기준이고 요청이 적은 칸은 판정하지 않는다', () => {
    const b = { at: '', requests: 1000, avgMs: 100, slow: 0, errors: 0 };
    expect(bucketLevel(b)).toBe('ok');
    expect(bucketLevel({ ...b, avgMs: 900 })).toBe('slow');
    expect(bucketLevel({ ...b, slow: 150 })).toBe('slow');
    expect(bucketLevel({ ...b, errors: 30 })).toBe('down');
    expect(bucketLevel({ ...b, requests: 50, errors: 30 })).toBe('unknown');
  });

  const watchEnv = (w: WatchState, cooldown = false) => {
    const book = {
      w,
      watch: async () => book.w,
      setWatch: async (n: WatchState) => void (book.w = n),
      claimIncident: async () => !cooldown,
    };
    const queued: Task[] = [];
    const env = {
      API_BASE: 'https://api.test',
      DESK_CHANNEL: 'CDESK',
      LEDGER: { idFromName: () => 'id', get: () => book },
      THREAD: {
        idFromName: () => 'id',
        get: () => ({ enqueue: async (t: Task) => queued.push(t) }),
      },
    } as unknown as Env;
    return { env, book, queued };
  };
  const at = (min: number) => new Date(NOW - min * 60_000).toISOString();
  const statusFetch = (buckets: unknown[]) =>
    (async () =>
      Response.json({ data: { generatedAt: '', buckets, days: [] } })) as unknown as typeof fetch;

  it('두 칸 이어 나쁘면 사건 하나를 새 글로 연다(지금 칸은 보지 않는다)', async () => {
    const { env, book, queued } = watchEnv({ bad: 0, fail: 0 });
    const slow = { requests: 500, avgMs: 1200, slow: 100, errors: 0 };
    const r = await watchStatus(
      env,
      NOW,
      statusFetch([
        { at: at(15), requests: 500, avgMs: 90, slow: 0, errors: 0 },
        { at: at(10), ...slow },
        { at: at(5), ...slow },
        { at: at(0), requests: 10, avgMs: 5000, slow: 10, errors: 10 },
      ]),
    );
    expect(r).toBe('incident');
    expect(book.w).toMatchObject({ bad: 2, lastAt: at(5) });
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      kind: 'incident',
      role: 'ops',
      threadTs: '',
      channel: 'CDESK',
    });
    expect(queued[0]!.text).toContain("2칸(10분) 이어 '느림'");
    // 같은 칸을 다시 읽으면 세지 않는다.
    expect(await watchStatus(env, NOW, statusFetch([{ at: at(5), ...slow }]))).toBe('ok bad=2');
    expect(queued).toHaveLength(1);
  });

  it('정상 칸이 오면 다시 0부터 세고, 상태 주소를 두 번 못 읽으면 사건이다', async () => {
    const { env, book, queued } = watchEnv({ bad: 1, fail: 0, lastAt: at(20) });
    await watchStatus(
      env,
      NOW,
      statusFetch([{ at: at(10), requests: 500, avgMs: 80, slow: 0, errors: 0 }]),
    );
    expect(book.w.bad).toBe(0);
    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    expect(await watchStatus(env, NOW, down)).toBe('fetch failed');
    expect(await watchStatus(env, NOW, down)).toBe('incident');
    expect(queued[0]!.text).toContain('읽지 못했어요');
  });

  it('6시간 안에 다시 열지 않는다', async () => {
    const { env, queued } = watchEnv({ bad: 1, fail: 0 }, true);
    const r = await watchStatus(
      env,
      NOW,
      statusFetch([{ at: at(5), requests: 500, avgMs: 80, slow: 0, errors: 50 }]),
    );
    expect(r).toBe('cooldown');
    expect(queued).toHaveLength(0);
  });

  it('운영 배포 뒤 배포 상태의 사건 카드는 확인을 예약하고 나머지는 닫는다', async () => {
    const calls: [string, string, unknown][] = [];
    const env = {
      LEDGER: {
        idFromName: () => 'id',
        get: () => ({
          cards: async () => [
            summary({ threadTs: 'a', status: '배포', source: 'incident' }),
            summary({ threadTs: 'b', status: '배포' }),
            summary({ threadTs: 'c', status: '수정' }),
          ],
        }),
      },
      CARD: {
        idFromName: (k: string) => k,
        get: (k: string) => ({
          scheduleChecks: async (sha: string) => void calls.push([k, 'checks', sha]),
          patch: async (p: unknown) => void calls.push([k, 'patch', p]),
        }),
      },
    } as unknown as Env;
    expect(await afterDeploy(env, 'a'.repeat(40), NOW)).toEqual({ checks: 1, closed: 1 });
    expect(calls[0]).toEqual(['C1:a', 'checks', 'a'.repeat(40)]);
    expect(calls[1]![0]).toBe('C1:b');
    expect(calls[1]![2]).toMatchObject({ status: '닫힘' });
  });
});

describe('주장', () => {
  it('#agent-desk에 멘션 없이 올린 글은 주장도 받지 않고, @이름으로 부르면 받는다', () => {
    const env = {
      OPERATOR_USER_ID: 'UOP',
      AGENT_APP_IDS: 'AOPS,APLAN',
      AGENT_BOT_USERS: 'UBOTOPS,UBOTPLAN,UBOTDEV,UBOTMKT',
      ALERT_CHANNELS: 'CALERT',
      DESK_CHANNEL: 'CDESK',
    } as Env;
    const ev = (e: Record<string, unknown>) =>
      ({
        type: 'message',
        channel: 'CDESK',
        ts: '5.5',
        user: 'UOP',
        text: '서버가 느리대요',
        ...e,
      }) as Parameters<typeof decide>[3];
    expect(decide(env, 'plan', 'E', ev({}), 'UBOTPLAN')).toBeNull();
    expect(
      decide(env, 'plan', 'E', ev({ text: '@박지성 서버가 느리대요' }), 'UBOTPLAN'),
    ).toMatchObject({
      kind: 'mention',
      threadTs: '5.5',
      text: '서버가 느리대요',
    });
    expect(
      decide(env, 'plan', 'E', ev({ thread_ts: '1.1', text: '진행해' }), 'UBOTPLAN'),
    ).toBeNull();
    expect(decide(env, 'ops', 'E', ev({}), 'UBOTOPS')).toBeNull();
    expect(decide(env, 'plan', 'E', ev({ user: 'USTRANGER' }), 'UBOTPLAN')).toBeNull();
    expect(decide(env, 'plan', 'E', ev({ channel: 'COTHER' }), 'UBOTPLAN')).toBeNull();
    expect(decide(env, 'plan', 'E', ev({ text: '<@UBOTDEV> 고쳐 줘' }), 'UBOTPLAN')).toBeNull();
    expect(decide(env, 'plan', 'E', ev({ text: '@손흥민 고쳐 줘' }), 'UBOTPLAN')).toBeNull();
  });

  type Book = {
    orders: WorkOrder[];
    autos: number;
    pending: unknown[];
    day: () => Promise<{ costUsd: number }>;
    autoStarts: () => Promise<number>;
    autoStart: () => Promise<number>;
    setOrder: (o: WorkOrder) => Promise<void>;
    order: (id: string) => Promise<WorkOrder | undefined>;
    pendingAdd: (p: unknown) => Promise<void>;
  };
  const setup = (autos = 0) => {
    const book: Book = {
      orders: [],
      autos,
      pending: [],
      day: async () => ({ costUsd: 0 }),
      autoStarts: async () => book.autos,
      autoStart: async () => ++book.autos,
      setOrder: async (o) => void book.orders.push(o),
      order: async (id) => book.orders.findLast((o) => o.id === id),
      pendingAdd: async (p) => void book.pending.push(p),
    };
    const patches: unknown[] = [];
    const opened: unknown[] = [];
    const slack: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (u: string, init?: { body?: string }) => {
      slack.push({ url: u, ...JSON.parse(init?.body ?? '{}') });
      return Response.json({ ok: true, ts: '7.7' });
    });
    const dispatched: unknown[] = [];
    const gh = (async (path: string, init?: { body?: unknown }) => {
      dispatched.push({ path, body: init?.body });
      return { status: 204, data: {} };
    }) as unknown as Gh;
    const env = {
      OPERATOR_USER_ID: 'UOP',
      APPROVAL_CHANNEL: 'CAPP',
      ALERT_CHANNELS: 'CALERT',
      GITHUB_REPO: 'o/r',
      DAILY_BUDGET_USD: '5',
      DAILY_BUDGET_DEV_USD: '20',
      DEV_RUN_BUDGET_USD: '5',
      LEDGER: { idFromName: () => 'id', get: () => book },
      CARD: {
        idFromName: () => 'id',
        get: () => ({
          patch: async (p: unknown) => (patches.push(p), patches.length > 1 ? {} : undefined),
          open: async (i: unknown) => (opened.push(i), i),
        }),
      },
    } as unknown as Env;
    const task = { kind: 'mention', role: 'plan', channel: 'CDESK', threadTs: '5.5' } as Task;
    // 한 답(도구 묶음 하나) 안에서 부른다.
    const tools = captainTools(env, task, async () => gh);
    const order = (input: Record<string, unknown>) =>
      tools.find((t) => t.name === 'work_order')!.run(input);
    return { env, book, patches, opened, slack, dispatched, order, gh };
  };

  it('작업 명세는 정해진 칸으로 쓰고 메일 주소를 가린다', async () => {
    expect(orderRequest({ goal: 'g', repro: '', scope: [], done: 'd', risk: 'mid' })).toContain(
      '재현 조건: 없음',
    );
    const s = setup();
    await s.order({
      title: '문구 a@example.com',
      goal: 'a@example.com 유저 화면',
      scope: ['docs/a.md'],
      done: 'd',
    });
    expect(s.book.orders[0]!.request).toContain('목표: (메일 주소 가림) 유저 화면');
    expect(s.book.orders[0]!.title).not.toContain('@');
  });

  it('반응 살피기 · 문의 정리에는 주장 도구가 없다', () => {
    const { env } = setup();
    for (const kind of ['triage', 'support', 'report', 'alert'] as const)
      expect(captainTools(env, { kind, threadTs: '1.1' } as Task)).toEqual([]);
    expect(
      captainTools(env, { kind: 'mention', threadTs: '1.1' } as Task).map((t) => t.name),
    ).toEqual(['card_update', 'work_order']);
  });

  it('낮음은 바로 띄우고, 하루 상한을 넘으면 시작 카드로 보낸다', async () => {
    const s = setup();
    const r = await s.order({ title: '문구', goal: 'g', scope: ['docs/a.md'], done: 'd' });
    expect(r).toContain('바로 띄웠어요');
    expect(s.dispatched).toHaveLength(1);
    expect(s.book.orders[0]).toMatchObject({
      risk: 'low',
      by: 'plan',
      started: true,
      thread: 'CDESK:5.5',
    });
    expect(s.opened[0]).toMatchObject({ status: '수정', owner: 'dev', risk: 'low' });

    const full = setup(AUTO_LIMIT);
    const r2 = await full.order({ title: '문구', goal: 'g', scope: ['docs/a.md'], done: 'd' });
    expect(r2).toContain('시작 카드');
    expect(full.dispatched).toHaveLength(0);
    expect(full.slack[0]).toMatchObject({ channel: 'CAPP' });
    expect(full.book.pending).toHaveLength(1);
  });

  it('범위가 중간이면 예상이 낮음이어도 시작 카드, 높음이면 시작하지 않는다', async () => {
    const mid = setup();
    const r = await mid.order({
      title: 'API',
      goal: 'g',
      scope: ['apps/api/src/routes/hof.ts'],
      done: 'd',
      risk_guess: 'low',
    });
    expect(r).toContain('위험도 중간');
    expect(mid.dispatched).toHaveLength(0);
    expect(mid.book.orders[0]).toMatchObject({ risk: 'mid', by: 'plan' });
    expect(mid.book.orders[0]!.started).toBeUndefined();

    const high = setup();
    const r2 = await high.order({
      title: 'DB',
      goal: 'g',
      scope: ['apps/api/migrations/0104.sql'],
      done: 'd',
    });
    expect(r2).toContain('시작하지 않았어요');
    expect(high.dispatched).toHaveLength(0);
    expect(high.slack).toHaveLength(0);
    expect(high.opened[0]).toMatchObject({ status: '보류' });
    // 한 답에 한 번만.
    expect(await high.order({ title: 'x', goal: 'g', scope: [], done: 'd' })).toContain('이미');
  });

  it('시작 카드는 운영자만 누를 수 있고, 같은 명세는 한 번만 시작한다', async () => {
    const s = setup();
    await s.order({ title: 'API', goal: 'g', scope: ['apps/api/src/app.ts'], done: 'd' });
    const id = s.book.orders[0]!.id;
    const press = (user: string, action = 'plan_start') =>
      startInteraction(
        s.env,
        {
          type: 'block_actions',
          user: { id: user },
          channel: { id: 'CAPP' },
          message: { ts: '7.7', blocks: [{}] },
          actions: [{ action_id: action, value: JSON.stringify({ order: id }) }],
        },
        async () => s.gh,
      );
    expect(await press('USTRANGER')).toBe('forbidden');
    expect(s.dispatched).toHaveLength(0);
    expect(await press('UOP')).toBe('started');
    expect(s.dispatched).toHaveLength(1);
    expect(await press('UOP')).toBe('duplicate');
    expect(s.dispatched).toHaveLength(1);
  });
});
