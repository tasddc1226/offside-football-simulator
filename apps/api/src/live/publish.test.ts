import type { LiveRetiredNumber } from '@offside/contracts';
import { CHAT_ROOMS } from '@offside/contracts/chat';
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
  it('라운지 모든 언어 방에 배너를 끼운다', async () => {
    const postNotice = vi.fn();
    const get = vi.fn(() => ({ postNotice }));
    const { c, pending } = context({ CHAT: { idFromName: (name: string) => name, get } });
    publishRetiredNumber(c, ITEM);
    await Promise.all(pending);
    expect(get).toHaveBeenCalledTimes(CHAT_ROOMS.length);
    expect(postNotice).toHaveBeenCalledTimes(CHAT_ROOMS.length);
    expect(postNotice).toHaveBeenCalledWith(ITEM);
  });

  it('방이 실패해도 던지지 않고, 라운지가 없으면 건너뛴다', async () => {
    const broken = context({
      CHAT: {
        idFromName: (name: string) => name,
        get: () => ({ postNotice: () => Promise.reject(new Error('down')) }),
      },
    });
    publishRetiredNumber(broken.c, ITEM);
    await expect(Promise.all(broken.pending)).resolves.toBeDefined();
    const none = context({});
    publishRetiredNumber(none.c, ITEM);
    expect(none.pending).toEqual([]);
  });
});
