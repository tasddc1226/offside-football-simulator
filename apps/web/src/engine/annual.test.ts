import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ANNUAL_POLICY } from '@offside/domain';
import type { AnnualRunResponse } from '@offside/contracts';
import { AnnualController, isForwardAnnual } from './annual.js';

const mocks = vi.hoisted(() => ({
  owner: 'owner-a',
  api: vi.fn(),
  remote: vi.fn(),
  imported: vi.fn(),
}));
vi.mock('../api/client.js', () => ({
  apiFetch: (...args: unknown[]) => mocks.api(...args),
  getProfile: async () => ({ ok: true, data: { id: mocks.owner } }),
  getRemoteCareer: (...args: unknown[]) => mocks.remote(...args),
}));
vi.mock('./engine.js', () => ({
  getAppEngine: async () => ({
    store: {
      transaction: async (_mode: unknown, run: (tx: unknown) => unknown) =>
        run({ kv: { get: async () => mocks.owner } }),
    },
  }),
}));
vi.mock('@offside/engine-client', () => ({
  importCareerFromServer: (...args: unknown[]) => mocks.imported(...args),
}));
vi.mock('../shared/query-client.js', () => ({
  queryClient: { invalidateQueries: async () => {} },
}));

function run(revision = 1, careerRevision = 5, id = 'run-one'): AnnualRunResponse {
  return {
    run: {
      id,
      careerId: 'career-one',
      revision,
      careerRevision,
      status: 'WAITING_DECISION',
      targetSeasonIndex: 1,
      completedCommands: 2,
      currentStep: 1,
      policy: DEFAULT_ANNUAL_POLICY,
      decision: {
        key: 'decision-one',
        revision: careerRevision,
        kind: 'EVENT',
        title: '중요한 선택',
        choices: [{ id: 'A', label: '선택' }],
      },
      report: null,
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = 'owner-a';
  mocks.remote.mockResolvedValue({ ok: true, data: {} });
  mocks.imported.mockResolvedValue({ ok: true, revision: 5 });
});
describe('annual controller authority and continuation', () => {
  it('coalesces duplicate start and accepts only canonical GET after an old receipt', async () => {
    const current = run(2, 8);
    mocks.api.mockImplementation(async (_path: string, init: RequestInit) => ({
      ok: true,
      data: init.method === 'POST' ? run(0, 3) : current,
    }));
    const update = vi.fn(),
      controller = new AnnualController('owner-a', 'career-one', update);
    await Promise.all([
      controller.start(3, DEFAULT_ANNUAL_POLICY),
      controller.start(3, DEFAULT_ANNUAL_POLICY),
    ]);
    expect(mocks.api.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    expect(controller.current).toEqual(current);
    expect(update).not.toHaveBeenCalledWith(run(0, 3));
  });
  it('resumes a saved waiting job without starting a second year', async () => {
    mocks.api.mockResolvedValue({ ok: true, data: run() });
    const controller = new AnnualController('owner-a', 'career-one', vi.fn());
    await controller.refresh();
    await controller.advance();
    expect(mocks.api.mock.calls.every(([, init]) => init.method !== 'POST')).toBe(true);
    expect(controller.current?.run.targetSeasonIndex).toBe(1);
  });
  it('late response after owner change or unmount cannot update or import', async () => {
    let release!: (value: unknown) => void;
    mocks.api.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const update = vi.fn(),
      controller = new AnnualController('owner-a', 'career-one', update);
    const pending = controller.refresh();
    await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledOnce());
    mocks.owner = 'owner-b';
    controller.dispose();
    release({ ok: true, data: run() });
    await expect(pending).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(mocks.imported).not.toHaveBeenCalled();
  });
  it('rejects job/career revision rollback and cross-career responses', () => {
    expect(isForwardAnnual(run(4, 30, 'new-year'), run(20, 29, 'old-year'))).toBe(false);
    expect(isForwardAnnual(run(4, 30), run(3, 30))).toBe(false);
    const foreign = run();
    foreign.run.careerId = 'foreign';
    expect(isForwardAnnual(run(), foreign)).toBe(false);
  });
  it('failed decision response can recover canonical waiting state without replaying choice', async () => {
    const controller = new AnnualController('owner-a', 'career-one', vi.fn());
    controller.current = run();
    mocks.api
      .mockResolvedValueOnce({ ok: false, error: { message: 'network' } })
      .mockResolvedValue({ ok: true, data: run(2, 9) });
    await expect(controller.choose('A')).rejects.toThrow('network');
    await controller.refresh();
    await controller.advance();
    expect(controller.current?.run.careerRevision).toBe(9);
    expect(mocks.api.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });
});
