// 운영자 멈춤: 명령 판정 · 대기열 비우기 · 돌던 답 끊기 · @dev 실행 취소 · 카드 보류.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODEL, runAgent, type Tool } from './claude.ts';
import { cancelDevRuns } from './dev.ts';
import type { Env } from './env.ts';
import type { Gh } from './github.ts';
import { decide } from './index.ts';
import { isStopCommand, stopThread } from './stop.ts';
import { AgentThread, type Task } from './thread.ts';

afterEach(() => vi.unstubAllGlobals());

const memoryStorage = () => {
  const m = new Map<string, unknown>();
  return {
    get: async (k: string) => m.get(k),
    put: async (k: string, v: unknown) => void m.set(k, v),
    getAlarm: async () => null,
    setAlarm: async () => undefined,
    m,
  };
};

describe('운영자 멈춤', () => {
  it('멈춤 명령 하나뿐인 글만 멈춤으로 본다', () => {
    for (const t of ['멈춰', '멈춰!', '멈춰 줘', '중단해', '그만', 'STOP', ' 멈춰요. '])
      expect(isStopCommand(t)).toBe(true);
    for (const t of ['멈춰 있는 이유 알려줘', '서버가 멈춰요?', '중단된 작업 다시', ''])
      expect(isStopCommand(t)).toBe(false);
  });

  it('운영자 멘션에서 온 멈춤만 멘션 일로 고른다', () => {
    const env = {
      OPERATOR_USER_ID: 'UOP',
      AGENT_APP_IDS: 'AOPS',
      AGENT_BOT_USERS: 'UBOTOPS',
      ALERT_CHANNELS: '',
    } as Env;
    const ev = (user: string) =>
      ({
        type: 'app_mention',
        user,
        text: '<@UBOTOPS> 멈춰',
        channel: 'C',
        ts: '2.2',
        thread_ts: '1.1',
      }) as Parameters<typeof decide>[3];
    const t = decide(env, 'ops', 'E', ev('UOP'), 'UBOTOPS');
    expect(t).toMatchObject({ kind: 'mention', text: '멈춰', threadTs: '1.1' });
    expect(isStopCommand(t!.text)).toBe(true);
    expect(decide(env, 'ops', 'E', ev('USTRANGER'), 'UBOTOPS')).toBeNull();
  });

  it('runAgent는 멈춤을 보면 다음 턴을 부르지 않고 지금까지 쓴 글로 끝낸다', async () => {
    let calls = 0;
    let stop = false;
    const fetcher = (async () => {
      calls++;
      stop = true; // 첫 턴이 도구를 부르는 동안 운영자가 멈췄다.
      return new Response(
        JSON.stringify({
          model: MODEL,
          stop_reason: 'tool_use',
          usage: { input_tokens: 10, output_tokens: 10 },
          content: [
            { type: 'text', text: '로그를 보는 중이에요' },
            { type: 'tool_use', id: 't', name: 'echo', input: {} },
          ],
        }),
      );
    }) as unknown as typeof fetch;
    const tools: Tool[] = [
      { name: 'echo', description: '', input_schema: { type: 'object' }, run: async () => 'ok' },
    ];
    const r = await runAgent({
      apiKey: 'k',
      system: 's',
      tools,
      messages: [{ role: 'user', content: '봐 줘' }],
      maxTurns: 10,
      budgetUsd: 1,
      fetcher,
      shouldStop: async () => stop,
    });
    expect(calls).toBe(1);
    expect(r).toMatchObject({ stopped: 'operator', turns: 1, text: '로그를 보는 중이에요' });
  });

  it('스레드 객체는 대기열을 비우고 멈춘 시각을 남긴다', async () => {
    const storage = memoryStorage();
    const t = new AgentThread({ storage } as never, {} as Env);
    await storage.put('queue', [{ eventId: 'a' }, { eventId: 'b' }]);
    expect(await t.stop(123)).toEqual({ cleared: 2, running: false });
    expect(storage.m.get('queue')).toEqual([]);
    expect(storage.m.get('stopAt')).toBe(123);
  });

  it('이 스레드가 띄운 끝나지 않은 @dev 실행만 취소한다', async () => {
    const calls: string[] = [];
    const g: Gh = async (path, init) => {
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path.startsWith('/actions/workflows/'))
        return {
          status: 200,
          data: {
            workflow_runs: [
              { id: 1, status: 'in_progress', display_title: '고침 [C:1.1]' },
              { id: 2, status: 'queued', display_title: '다른 일 [C:9.9]' },
              { id: 3, status: 'completed', display_title: '지난 일 [C:1.1]' },
              { id: 4, status: 'queued', display_title: '또 [C:1.1]' },
            ],
          } as never,
        };
      return { status: 202, data: {} as never };
    };
    expect(await cancelDevRuns(g, 'C:1.1')).toEqual([1, 4]);
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([
      'POST /actions/runs/1/cancel',
      'POST /actions/runs/4/cancel',
    ]);
  });

  const stopEnv = (claimed = true) => {
    const stopped: string[] = [];
    const patches: unknown[] = [];
    const env = {
      ENABLED_ROLES: 'ops,plan,dev',
      GITHUB_REPO: 'o/r',
      GITHUB_APP_PRIVATE_KEY: 'k',
      SLACK_OPS_BOT_TOKEN: 't',
      LEDGER: { idFromName: () => 'id', get: () => ({ claimStop: async () => claimed }) },
      THREAD: {
        idFromName: (n: string) => n,
        get: (n: string) => ({
          stop: async () => {
            stopped.push(n);
            return n.startsWith('ops:')
              ? { cleared: 1, running: true }
              : { cleared: 0, running: false };
          },
        }),
      },
      CARD: {
        idFromName: () => 'id',
        get: () => ({ patch: async (p: unknown) => (patches.push(p), { status: '보류' }) }),
      },
    } as unknown as Env;
    return { env, stopped, patches };
  };
  const task = (o: Partial<Task> = {}) =>
    ({
      eventId: 'E',
      kind: 'mention',
      role: 'ops',
      channel: 'C',
      threadTs: '1.1',
      sourceTs: '2.2',
      text: '멈춰',
      ...o,
    }) as Task;
  const slackPosts = () => {
    const posts: { text: string }[] = [];
    vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
      posts.push(JSON.parse(String(init.body)));
      return Response.json({ ok: true, ts: '3.3' });
    });
    return posts;
  };

  it('스레드의 모든 역할 · @dev 실행 · 카드를 멈추고 한 번 알린다', async () => {
    const posts = slackPosts();
    const { env, stopped, patches } = stopEnv();
    const g: Gh = async (path) =>
      path.startsWith('/actions/workflows/')
        ? {
            status: 200,
            data: {
              workflow_runs: [{ id: 7, status: 'in_progress', display_title: 'x [C:1.1]' }],
            } as never,
          }
        : { status: 202, data: {} as never };
    expect(await stopThread(env, task(), async () => g)).toBe('stopped');
    expect(stopped).toEqual(['ops:C:1.1', 'plan:C:1.1', 'dev:C:1.1']);
    expect(patches).toEqual([{ status: '보류', note: '운영자 멈춤', next: null }]);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toContain('돌고 있던 답 1개');
    expect(posts[0]!.text).toContain('기다리던 일 1개');
    expect(posts[0]!.text).toContain('actions/runs/7');
    expect(posts[0]!.text).toContain('운영 배포');
  });

  it('여러 봇이 같은 글을 받으면 한 번만 처리하고, 스레드 밖이면 멈추지 않는다', async () => {
    const posts = slackPosts();
    const dup = stopEnv(false);
    expect(await stopThread(dup.env, task(), async () => ({}) as never)).toBe('duplicate');
    expect(dup.stopped).toEqual([]);
    const top = stopEnv();
    expect(await stopThread(top.env, task({ threadTs: '2.2' }))).toBe('not thread');
    expect(top.stopped).toEqual([]);
    expect(posts).toHaveLength(1);
  });
});
