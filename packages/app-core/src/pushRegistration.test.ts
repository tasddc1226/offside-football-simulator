import { describe, expect, it, vi } from 'vitest';
import { createPushRegistration, type PushRegistrationState } from './pushRegistration';
function fixture(wanted = false) {
  let removal = false;
  const state: PushRegistrationState = {
    enabled: wanted,
    busy: false,
    blocked: false,
    failed: false,
    message: '',
  };
  const io = {
    wanted: () => wanted,
    saveWanted: (on: boolean) => {
      wanted = on;
    },
    pendingRemoval: () => removal,
    savePendingRemoval: (on: boolean) => {
      removal = on;
    },
    permission: vi.fn(
      async (_request: boolean): Promise<'granted' | 'denied' | 'blocked'> => 'granted',
    ),
    register: vi.fn(async () => {}),
    unregister: vi.fn(async () => {}),
  };
  return { state, io, controller: createPushRegistration(state, io) };
}
describe('push opt-in lifecycle', () => {
  it('does nothing before consent and only explicit opt-in prompts', async () => {
    const { controller, io, state } = fixture();
    await controller.restore();
    expect(io.permission).not.toHaveBeenCalled();
    await controller.setEnabled(true);
    expect(io.permission).toHaveBeenCalledWith(true);
    expect(io.register).toHaveBeenCalledOnce();
    expect(state.enabled).toBe(true);
  });
  it('does not register or persist consent after denial', async () => {
    const { controller, io, state } = fixture();
    io.permission.mockResolvedValue('blocked');
    await controller.setEnabled(true);
    expect(io.register).not.toHaveBeenCalled();
    expect(io.wanted()).toBe(false);
    expect(state.blocked).toBe(true);
  });
  it('restores without prompting and removes registration after OS permission revocation', async () => {
    const { controller, io, state } = fixture(true);
    io.permission.mockResolvedValue('denied');
    await controller.restore();
    expect(io.permission).toHaveBeenCalledWith(false);
    expect(io.unregister).toHaveBeenCalledOnce();
    expect(state.enabled).toBe(false);
  });
  it('persists offline removal and retries without re-enabling', async () => {
    const { controller, io, state } = fixture(true);
    io.unregister.mockRejectedValueOnce(new Error('offline'));
    await controller.setEnabled(false);
    expect(state.enabled).toBe(false);
    expect(io.wanted()).toBe(false);
    expect(io.pendingRemoval()).toBe(true);
    await controller.restore();
    expect(io.unregister).toHaveBeenCalledTimes(2);
    expect(io.pendingRemoval()).toBe(false);
    expect(io.register).not.toHaveBeenCalled();
  });
  it('coalesces session/token changes arriving during registration', async () => {
    const { controller, io, state } = fixture(true);
    let finish!: () => void;
    io.register.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = controller.restore();
    await vi.waitFor(() => expect(io.register).toHaveBeenCalledOnce());
    await controller.restore();
    await controller.restore();
    finish();
    await first;
    expect(io.register).toHaveBeenCalledTimes(2);
    expect(io.permission.mock.calls).toEqual([[false], [false]]);
    expect(state.busy).toBe(false);
  });
  it('keeps failures retryable without claiming success', async () => {
    const { controller, io, state } = fixture();
    io.register.mockRejectedValueOnce(new Error('offline'));
    await controller.setEnabled(true);
    expect(state.enabled).toBe(false);
    expect(state.failed).toBe(true);
    expect(io.wanted()).toBe(false);
    await controller.setEnabled(true);
    expect(state.enabled).toBe(true);
    expect(state.failed).toBe(false);
  });
});
