import { describe, expect, it } from 'vitest';
import { toErrorEnvelope } from './errors.js';

describe('toErrorEnvelope unknown errors (T-2-015)', () => {
  it('SQL 전문 대신 고정 문구를 503으로 돌려준다', () => {
    const err = new Error('Failed query: insert into "analytics_events" ("id","client_id") values (?,?)');
    const { status, body } = toErrorEnvelope(err, 'req_test');

    expect(status).toBe(503);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.message).toBe('일시적인 오류입니다. 잠시 후 다시 시도해 주세요.');
    expect(body.error.message).not.toContain('insert');
  });

  it('Error가 아닌 값을 던져도 같은 고정 문구를 돌려준다', () => {
    const { status, body } = toErrorEnvelope('boom', 'req_test');

    expect(status).toBe(503);
    expect(body.error.message).toBe('일시적인 오류입니다. 잠시 후 다시 시도해 주세요.');
  });
});
