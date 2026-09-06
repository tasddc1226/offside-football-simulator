import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { loadContentPack } from '@offside/content';
import { rulesetProto } from '@offside/fixtures';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppEngine, type AppEngine } from './engine.js';
import { FALLBACK_SERVICE_SEASON_ID } from './versions.js';

const getServiceSeasonCurrentMock = vi.fn();
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, getServiceSeasonCurrent: () => getServiceSeasonCurrentMock() };
});

const engineHolder: { current: AppEngine | undefined } = { current: undefined };
vi.mock('./engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine.js')>();
  return { ...actual, getAppEngine: () => Promise.resolve(engineHolder.current) };
});

const SERVICE_SEASON = {
  id: 'svc_line_test',
  name: 'LINE TEST',
  status: 'PRESEASON' as const,
  isTest: true,
  startsAt: '2026-09-08T00:00:00Z',
  endsAt: '2026-10-31T23:59:59Z',
  rulesetVersion: '1.0.0',
  contentPackVersion: '0.1.0',
  notice: 'LINE_TEST' as const,
};

describe('service-season 폴백 순서(네트워크 실패 → kv-store → 상수)', () => {
  beforeEach(async () => {
    vi.resetModules();
    engineHolder.current = createAppEngine({
      store: new MemoryLocalStore(),
      simulator: inlineSimulator,
      ruleset: rulesetProto,
      pack: loadContentPack('0.1.0'),
    });
    getServiceSeasonCurrentMock.mockReset();
  });

  it('네트워크 성공이면 그 id를 돌려주고 kv-store에 저장한다', async () => {
    getServiceSeasonCurrentMock.mockResolvedValue({ ok: true, data: SERVICE_SEASON });
    const { resolveServiceSeasonId } = await import('./service-season.js');

    const id = await resolveServiceSeasonId();

    expect(id).toBe('svc_line_test');
    const cached = await engineHolder.current!.store.transaction('readonly', (tx) => tx.kv.get('service-season:current'));
    expect(cached).toEqual(SERVICE_SEASON);
  });

  it('커리어 생성용 조회는 id와 두 버전을 같은 응답에서 돌려준다', async () => {
    getServiceSeasonCurrentMock.mockResolvedValue({ ok: true, data: SERVICE_SEASON });
    const { resolveServiceSeason } = await import('./service-season.js');

    await expect(resolveServiceSeason()).resolves.toEqual(SERVICE_SEASON);
  });

  it('종료일이 미정인 시즌도 그대로 저장하고 복원한다', async () => {
    const openEndedSeason = {
      ...SERVICE_SEASON,
      endsAt: null,
    };
    getServiceSeasonCurrentMock.mockResolvedValue({ ok: true, data: openEndedSeason });
    const { resolveServiceSeason } = await import('./service-season.js');

    await expect(resolveServiceSeason()).resolves.toEqual(openEndedSeason);
    const cached = await engineHolder.current!.store.transaction('readonly', (tx) =>
      tx.kv.get('service-season:current'),
    );
    expect(cached).toEqual(openEndedSeason);
  });

  it('네트워크 실패면 kv-store에 저장된 마지막 성공 값을 쓴다', async () => {
    await engineHolder.current!.store.transaction('readwrite', (tx) => tx.kv.put('service-season:current', SERVICE_SEASON));
    getServiceSeasonCurrentMock.mockResolvedValue({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: '실패', retryable: true },
    });
    const { resolveServiceSeasonId } = await import('./service-season.js');

    const id = await resolveServiceSeasonId();

    expect(id).toBe('svc_line_test');
  });

  it('네트워크 실패고 kv-store도 비어 있으면 상수로 폴백한다', async () => {
    getServiceSeasonCurrentMock.mockResolvedValue({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: '실패', retryable: true },
    });
    const { resolveServiceSeasonId } = await import('./service-season.js');

    const id = await resolveServiceSeasonId();

    expect(id).toBe(FALLBACK_SERVICE_SEASON_ID);
  });
});
