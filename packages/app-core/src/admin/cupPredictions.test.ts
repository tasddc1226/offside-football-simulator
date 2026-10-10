import { describe, it, expect, vi, afterEach } from 'vitest';
import * as api from '../api/admin.js';
import { createCupAdmin, emptyCupAdmin } from './cupPredictions.js';
import type { AdminCupPredictions } from '../api/admin.js';

const report = (cupId: string): AdminCupPredictions => ({ cupId, participants: 0, items: [] });
describe('cup admin request scopes', () => {
  afterEach(() => vi.restoreAllMocks());
  it('ignores an earlier cup response and an earlier match detail after switching cups', async () => {
    let finish!: (r: Awaited<ReturnType<typeof api.fetchAdminCupPredictions>>) => void;
    vi.spyOn(api, 'fetchAdminCupPredictions').mockImplementation((id) =>
      id === 's1-1'
        ? new Promise((r) => (finish = r))
        : Promise.resolve({ ok: true, data: report(id) }),
    );
    let state = emptyCupAdmin();
    const model = createCupAdmin((s) => (state = s));
    const first = model.select('s1-1');
    await model.select('s2-1');
    finish({ ok: true, data: report('s1-1') });
    await first;
    expect(state.report?.cupId).toBe('s2-1');
    let detail!: (r: Awaited<ReturnType<typeof api.fetchAdminCupPredictionRows>>) => void;
    vi.spyOn(api, 'fetchAdminCupPredictionRows').mockImplementation(
      () => new Promise((r) => (detail = r)),
    );
    const pending = model.details('old-match');
    await model.select('s2-2');
    detail({ ok: true, data: { items: [], next: null } });
    await pending;
    expect(state.matchId).toBe('');
    expect(state.rows).toBeNull();
    model.dispose();
  });
});
