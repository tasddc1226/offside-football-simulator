import { describe, expect, it, vi } from 'vitest';
import { sendPushTest } from './expo.js';
describe('Expo test request', () => {
  it('sends one fixed safe payload and accepts a successful ticket', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { status: 'ok', id: 'ticket' } }));
    expect(await sendPushTest('ExpoPushToken[own_device]', 'private-secret', send)).toBe('ticket');
    expect(send).toHaveBeenCalledOnce();
    const [url, init] = send.mock.calls[0]!;
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(init?.redirect).toBe('manual');
    expect(JSON.parse(init!.body as string).data).toEqual({
      type: 'offside-news',
      board: 'notice',
      test: true,
    });
  });
  it('does not retry ambiguous network errors or expose transport details', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('private-secret'));
    await expect(
      sendPushTest('ExpoPushToken[own_device]', 'private-secret', send),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(send).toHaveBeenCalledOnce();
  });
  it('rejects redirects without following or retrying the request', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 307, headers: { Location: 'https://redirect.invalid/' } }),
      );
    await expect(sendPushTest('ExpoPushToken[own_device]', undefined, send)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]![1]?.redirect).toBe('manual');
  });
  it('identifies invalid tokens for removal', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }),
      );
    await expect(sendPushTest('ExpoPushToken[own_device]', undefined, send)).rejects.toMatchObject({
      details: { reason: 'PUSH_DEVICE_NOT_REGISTERED' },
    });
  });
  it('rejects HTTP errors and incomplete tickets', async () => {
    for (const response of [
      new Response('failed', { status: 503 }),
      Response.json({ data: {} }),
      Response.json({ data: { status: 'ok' } }),
      Response.json({ data: { status: 'ok', id: '<unsafe>' } }),
      Response.json(null),
      new Response('invalid json'),
    ]) {
      const send = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        sendPushTest('ExpoPushToken[own_device]', undefined, send),
      ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    }
  });
});
