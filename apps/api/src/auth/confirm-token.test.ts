import { describe, expect, it } from 'vitest';
import { signConfirmToken, verifyConfirmToken } from './confirm-token.js';

const BASE = {
  sessionId: 'ses_1',
  sessionTokenHash: 'a'.repeat(64),
  expiresAt: '2026-09-02T00:10:00.000Z',
};

describe('confirm-token', () => {
  it('올바른 세션·시각으로 검증하면 ok', async () => {
    const token = await signConfirmToken(BASE);
    const result = await verifyConfirmToken(token, {
      sessionId: BASE.sessionId,
      sessionTokenHash: BASE.sessionTokenHash,
      now: '2026-09-02T00:00:00.000Z',
    });
    expect(result.ok).toBe(true);
  });

  it('만료 시각 이후는 무효', async () => {
    const token = await signConfirmToken(BASE);
    const result = await verifyConfirmToken(token, {
      sessionId: BASE.sessionId,
      sessionTokenHash: BASE.sessionTokenHash,
      now: '2026-09-02T00:10:00.000Z',
    });
    expect(result.ok).toBe(false);
  });

  it('다른 세션 id로 검증하면 무효', async () => {
    const token = await signConfirmToken(BASE);
    const result = await verifyConfirmToken(token, {
      sessionId: 'ses_other',
      sessionTokenHash: BASE.sessionTokenHash,
      now: '2026-09-02T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
  });

  it('다른 세션의 tokenHash로 검증하면 무효(서명 불일치)', async () => {
    const token = await signConfirmToken(BASE);
    const result = await verifyConfirmToken(token, {
      sessionId: BASE.sessionId,
      sessionTokenHash: 'b'.repeat(64),
      now: '2026-09-02T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
  });

  it('형식이 깨진 토큰은 무효', async () => {
    const result = await verifyConfirmToken('not-a-real-token', {
      sessionId: BASE.sessionId,
      sessionTokenHash: BASE.sessionTokenHash,
      now: '2026-09-02T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
  });
});
