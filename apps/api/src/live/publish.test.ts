import type { LiveRetiredNumber } from '@offside/contracts';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../env.js';
import { publishRetiredNumber } from './publish.js';

const ITEM: LiveRetiredNumber = {
  careerId: 'car_1',
  name: '하늘선수',
  pos: 'FW',
  clubId: 'c1',
  club: '하늘 FC',
  number: 9,
  seq: 1,
  season: 2,
  at: '2026-11-02T00:00:00.000Z',
};

const context = (env: Record<string, unknown>) => {
  const pending: Promise<unknown>[] = [];
  const c = {
    env,
    executionCtx: { waitUntil: (p: Promise<unknown>) => pending.push(p) },
  } as unknown as Context<AppEnv>;
  return { c, pending };
};

describe('publishRetiredNumber', () => {
  it('홈 라이브 허브로만 알리고 라운지 방은 건드리지 않는다', async () => {
    const publish = vi.fn();
    const chatGet = vi.fn();
    const { c, pending } = context({
      LIVE: { idFromName: (name: string) => name, get: () => ({ publish }) },
      CHAT: { idFromName: (name: string) => name, get: chatGet },
    });
    publishRetiredNumber(c, ITEM);
    await Promise.all(pending);
    expect(publish).toHaveBeenCalledWith(JSON.stringify({ type: 'retiredNumber', item: ITEM }));
    expect(chatGet).not.toHaveBeenCalled();
  });
});
