import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { rankMemories, type Memory } from './ledger.ts';
import { memoryTools } from './memory.ts';
import type { Task } from './thread.ts';

const mem = (at: number, text: string, kind: Memory['kind'] = 'card'): Memory => ({
  at,
  kind,
  role: 'plan',
  text,
  channel: 'C1',
  threadTs: `${at}.1`,
});

describe('스레드를 넘는 기억 (T-11-332)', () => {
  const all = [
    mem(1, '[닫힘] 임대 화면 저장 실패 → 배포 뒤 0건, 닫음'),
    mem(2, '임대 고도화는 11월 데이터 보고 판단', 'decision'),
    mem(3, '[보류] 라운지 채팅 느림 → 재현 안 됨'),
  ];

  it('낱말이 많이 맞는 것부터, 같으면 최근 것부터 찾는다', () => {
    expect(rankMemories(all, '임대 저장', 5).map((m) => m.at)).toEqual([1, 2]);
    expect(rankMemories(all, '임대', 5).map((m) => m.at)).toEqual([2, 1]);
    expect(rankMemories(all, '', 2).map((m) => m.at)).toEqual([3, 2]);
    expect(rankMemories(all, '결제', 5)).toEqual([]);
  });

  it('recall은 모든 역할, remember는 주장이 운영자 지시 스레드에서만 쓴다', async () => {
    const store = { recall: vi.fn(async () => [all[1]!]), remember: vi.fn(async () => {}) };
    const task = { kind: 'mention', channel: 'C9', threadTs: '9.9' } as Task;
    const ops = memoryTools({ DISCORD_GUILD_ID: '42' } as Env, 'ops', task, store as never);
    expect(ops.map((t) => t.name)).toEqual(['recall']);
    expect(await ops[0]!.run({ query: '임대' })).toBe(
      '- 1970-01-01 결정(@plan): 임대 고도화는 11월 데이터 보고 판단 · https://discord.com/channels/42/C1/2.1',
    );
    const plan = memoryTools({} as Env, 'plan', task, store as never);
    expect(await plan[1]!.run({ decision: '  구단명 신고는 3건부터 숨김  ' })).toBe('남겼어요');
    expect(store.remember).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'decision',
        text: '구단명 신고는 3건부터 숨김',
        channel: 'C9',
        threadTs: '9.9',
      }),
    );
    const triage = memoryTools(
      {} as Env,
      'plan',
      { kind: 'triage', channel: 'C', threadTs: '' } as Task,
      store as never,
    );
    expect(triage.map((t) => t.name)).toEqual(['recall']);
  });
});
