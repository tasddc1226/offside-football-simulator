import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHofDetail } from './api/client.js';
import { checkShareLink } from './shareLink.js';

vi.mock('./api/client.js', () => ({ getHofDetail: vi.fn() }));
const detail = vi.mocked(getHofDetail);
const url = (id: string) => `https://x.test/career/${id}`;
const fail = (code: 'NOT_FOUND' | 'NETWORK', reason?: string) =>
  ({
    ok: false,
    error: { code, message: '', retryable: false, ...(reason ? { reason } : {}) },
  }) as never;

describe('공유 링크 확인', () => {
  beforeEach(() => detail.mockReset());

  it('업로드 큐를 먼저 비우고, 서버에 있으면 링크를 돌려준다', async () => {
    const order: string[] = [];
    detail.mockImplementation(async () => (order.push('detail'), { ok: true, data: {} }) as never);
    const flush = vi.fn(async () => void order.push('flush'));
    await expect(checkShareLink('c1', { flush, url })).resolves.toBe('https://x.test/career/c1');
    expect(order).toEqual(['flush', 'detail']);
  });

  it('업로드 큐 비우기가 실패해도 확인은 한다', async () => {
    detail.mockResolvedValue({ ok: true, data: {} } as never);
    const flush = () => Promise.reject(new Error('offline'));
    await expect(checkShareLink('c1', { flush, url })).resolves.toBe('https://x.test/career/c1');
  });

  it('아직 서버에 없으면 업로드 안내, 그 밖의 실패는 연결 안내로 던진다', async () => {
    const flush = async () => {};
    detail.mockResolvedValueOnce(fail('NOT_FOUND', 'HOF_NOT_FOUND'));
    await expect(checkShareLink('c1', { flush, url })).rejects.toThrow(
      '기록을 아직 서버에 올리지 못했어요',
    );
    detail.mockResolvedValueOnce(fail('NETWORK'));
    await expect(checkShareLink('c1', { flush, url })).rejects.toThrow('서버에 연결하지 못했어요');
  });

  it('T-11-433 서버가 거절한 기록이면 잠시 후 대신 이유를 말한다', async () => {
    const stored = new Map<string, string>([
      [
        'ft_outbox:rejected',
        JSON.stringify([
          {
            kind: 'retirement',
            careerId: 'c1',
            body: {},
            rejected: { status: 400, code: 'VALIDATION_FAILED', reason: 'NO_SEASONS', at: 0 },
          },
        ]),
      ],
    ]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => stored.get(k) ?? null, setItem() {} });
    detail.mockResolvedValueOnce(fail('NOT_FOUND', 'HOF_NOT_FOUND'));
    const err = await checkShareLink('c1', { flush: async () => {}, url }).catch((e: Error) => e);
    vi.unstubAllGlobals();
    expect((err as Error).message).toContain('시즌 기록이 서버에 없어서');
    expect((err as Error).message).not.toContain('잠시 후');
  });
});
