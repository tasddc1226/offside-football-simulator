import { afterEach, describe, expect, it, vi } from 'vitest';
import { acknowledgeAfterGrant } from './acknowledgement.js';
import { billingAlertId } from './alerts.js';
import { googleAcknowledgementError } from './google-error.js';

const event = {
  job: 'iap-ack',
  store: 'google',
  transactionId: 'private-purchase-token',
  kind: 'purchase',
  productId: 'com.offsidelab.app.reroll_5',
  test: true,
} as const;

afterEach(() => vi.restoreAllMocks());

describe('post-grant Google acknowledgement diagnostics', () => {
  it('does not log or repeat a successful acknowledgement', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn().mockResolvedValue(undefined);
    await acknowledgeAfterGrant(after, event);
    expect(after).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it.each(['iap-ack', 'pass-ack'] as const)(
    '%s correlates an HTTP failure with the billing ledger without exposing response text',
    async (job) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = await googleAcknowledgementError(
        Response.json(
          {
            error: {
              message: `secret ${event.transactionId}`,
              status: 'INVALID_ARGUMENT',
              errors: [{ reason: 'invalidPurchaseState', location: event.transactionId }],
            },
          },
          { status: 400 },
        ),
      );
      const after = vi.fn().mockRejectedValue(error);
      await expect(acknowledgeAfterGrant(after, { ...event, job })).resolves.toBeUndefined();
      expect(after).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledOnce();
      expect(JSON.parse(log.mock.calls[0]![0])).toEqual({
        job,
        store: 'google',
        productId: event.productId,
        test: true,
        grantCompleted: true,
        id: await billingAlertId(event),
        error: 'Google acknowledgement failed',
        failure: 'http',
        httpStatus: 400,
        reason: 'invalidPurchaseState',
        googleStatus: 'INVALID_ARGUMENT',
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain(event.transactionId);
    },
  );

  it('does not serialize transport/auth exception messages or stacks', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi
      .fn()
      .mockRejectedValue(new Error(`fetch https://provider/${event.transactionId}`));
    await acknowledgeAfterGrant(after, event);
    expect(after).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({
      failure: 'request',
      grantCompleted: true,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(event.transactionId);
    expect(JSON.stringify(log.mock.calls)).not.toContain('https://');
  });

  it('still records the failure if the diagnostic fingerprint cannot be computed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('private hash error'));
    await expect(
      acknowledgeAfterGrant(vi.fn().mockRejectedValue(new Error('private transport error')), event),
    ).resolves.toBeUndefined();
    expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({ job: 'iap-ack', failure: 'request' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  });
});

describe('bounded Google HTTP error extraction', () => {
  it.each([400, 401, 403, 409, 429, 500, 503])(
    'preserves HTTP %i without treating it as success',
    async (status) => {
      const error = await googleAcknowledgementError(new Response('', { status }));
      expect(error.httpStatus).toBe(status);
      expect(error.reason).toBe('unknown');
      expect(error.message).toContain(String(status));
    },
  );

  it.each([
    '<html>private-purchase-token</html>',
    'null',
    JSON.stringify({
      error: { errors: [{ reason: 'private-purchase-token' }], status: 'private-purchase-token' },
    }),
    JSON.stringify({ error: { errors: 'private-purchase-token' } }),
    JSON.stringify({ error: { errors: [null, {}, { reason: 123 }] } }),
  ])('discards malformed or unrecognized response fields', async (body) => {
    const error = await googleAcknowledgementError(new Response(body, { status: 400 }));
    expect(error.reason).toBe('unknown');
    expect(error.googleStatus).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('private-purchase-token');
  });

  it('cancels an oversized stream without reading the rest', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8193));
      },
      cancel,
    });
    const error = await googleAcknowledgementError(new Response(stream, { status: 502 }));
    expect(error.httpStatus).toBe(502);
    expect(error.reason).toBe('unknown');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('preserves status when reading the error body fails', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('private-purchase-token'));
      },
    });
    const error = await googleAcknowledgementError(new Response(stream, { status: 503 }));
    expect(error.httpStatus).toBe(503);
    expect(error.reason).toBe('unknown');
  });
});
