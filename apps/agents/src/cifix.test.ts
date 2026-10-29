// @dev PR CI가 실패하면 실패 로그를 붙여 같은 브랜치에서 한 번 고치게 한다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { devCi, MAX_FIXES, type DevCi } from './dev.ts';
import type { Env } from './env.ts';
import type { Gh } from './github.ts';
import type { DevJob } from './ledger.ts';
import { fakeChat } from './testChat.ts';

afterEach(() => vi.unstubAllGlobals());

const job = (o: Partial<DevJob> = {}): DevJob => ({
  channel: 'C',
  threadTs: '1.1',
  pr: 7,
  title: 'T-11-999: 고침',
  ...o,
});

function setup(j: DevJob, spent = 0) {
  const jobs = new Map<string, DevJob>([['agent-dev/100', j]]);
  const posts: { text: string }[] = [];
  vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
    posts.push(JSON.parse(String(init.body)));
    return Response.json({ ok: true, ts: '5.5' });
  });
  const book = {
    devJob: async (b: string) => jobs.get(b),
    setDevJob: async (b: string, v: DevJob) => void jobs.set(b, v),
    orderOf: async () => ({ request: '목록 첫 항목을 보여 줘' }),
    day: async () => ({ costUsd: spent }),
  };
  const env = {
    GITHUB_REPO: 'o/r',
    DISCORD: fakeChat,
    DAILY_BUDGET_USD: '5',
    DAILY_BUDGET_DEV_USD: '20',
    DEV_RUN_BUDGET_USD: '5',
    LEDGER: { idFromName: () => 'id', get: () => book },
    CARD: { idFromName: () => 'id', get: () => ({ patch: async () => ({}) }) },
  } as unknown as Env;
  const dispatched: Record<string, unknown>[] = [];
  const g: Gh = async (path, init) => {
    if (path.startsWith('/pulls/'))
      return {
        status: 200,
        data: { number: 7, state: 'open', head: { sha: 'abc', ref: 'agent-dev/100' } } as never,
      };
    if (path.includes('/dispatches')) {
      dispatched.push(init?.body as Record<string, unknown>);
      return { status: 204, data: {} as never };
    }
    return { status: 200, data: {} as never };
  };
  return { env, jobs, posts, dispatched, gh: async () => g };
}

const failed: DevCi = {
  branch: 'agent-dev/100',
  sha: 'abc',
  conclusion: 'failure',
  url: 'https://github.com/o/r/actions/runs/555',
};

describe('CI 실패 고치기', () => {
  it('처음 실패하면 같은 브랜치 · 실패한 CI 번호로 고치기를 띄우고 횟수를 남긴다', async () => {
    const s = setup(job());
    expect(await devCi(s.env, failed, s.gh)).toBe('fixing');
    expect(s.dispatched).toHaveLength(1);
    const inputs = (s.dispatched[0] as { inputs: Record<string, string> }).inputs;
    expect(inputs).toMatchObject({ branch: 'agent-dev/100', ci_run: '555', thread: 'C:1.1' });
    expect(inputs.request).toContain('목록 첫 항목을 보여 줘');
    expect(inputs.request).toContain('테스트를 지우거나');
    expect(s.jobs.get('agent-dev/100')!.fixes).toBe(1);
    expect(s.posts.at(-1)!.text).toContain('한 번 고치게 했어요');
  });

  it(`${MAX_FIXES}번 고치게 한 뒤 또 실패하면 운영자에게 넘긴다`, async () => {
    const s = setup(job({ fixes: MAX_FIXES }));
    expect(await devCi(s.env, failed, s.gh)).toBe('failed');
    expect(s.dispatched).toHaveLength(0);
    expect(s.posts.at(-1)!.text).toContain('다시 지시해 주세요');
  });

  it('오늘 남은 금액이 모자라면 띄우지 않고 횟수도 쓰지 않는다', async () => {
    const s = setup(job(), 18);
    expect(await devCi(s.env, failed, s.gh)).toBe('failed');
    expect(s.dispatched).toHaveLength(0);
    expect(s.jobs.get('agent-dev/100')!.fixes).toBeUndefined();
    expect(s.posts.at(-1)!.text).toContain('남은 금액');
  });

  it('새 커밋으로 밀린 실패 · 취소는 넘긴다', async () => {
    const s = setup(job());
    expect(await devCi(s.env, { ...failed, sha: 'old' }, s.gh)).toBe('stale');
    expect(await devCi(s.env, { ...failed, conclusion: 'cancelled' }, s.gh)).toBe('ignored');
    expect(s.dispatched).toHaveLength(0);
  });
});
