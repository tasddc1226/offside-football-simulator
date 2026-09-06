import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareGoogleConnect } from './google-connect.js';

const flushMock = vi.fn();
const listCareersMock = vi.fn();
const getStateMock = vi.fn();

vi.mock('./sync.js', () => ({
  getSyncClient: () => Promise.resolve({ flush: flushMock, getState: getStateMock }),
}));
vi.mock('./engine.js', () => ({
  getAppEngine: () => Promise.resolve({ client: { listCareers: listCareersMock } }),
}));

describe('prepareGoogleConnect', () => {
  beforeEach(() => {
    flushMock.mockReset().mockResolvedValue(undefined);
    listCareersMock.mockReset();
    getStateMock
      .mockReset()
      .mockReturnValue({ kind: 'IDLE', lastSyncedRevision: 4, lastSyncedAt: null });
  });

  it('flush가 오류를 상태로만 남겨도 미전송 revision이 남으면 OAuth 이동을 막는다', async () => {
    listCareersMock.mockResolvedValue([{ id: 'car_1', revision: 4, lastSyncedRevision: 3 }]);
    await expect(prepareGoogleConnect()).resolves.toMatchObject({ ok: false });
    expect(flushMock).toHaveBeenCalledOnce();
  });

  it('모든 커리어가 저장된 뒤에만 OAuth 이동을 허용한다', async () => {
    listCareersMock.mockResolvedValue([{ id: 'car_1', revision: 4, lastSyncedRevision: 4 }]);
    await expect(prepareGoogleConnect()).resolves.toEqual({ ok: true });
  });

  it('revision이 같아도 동기화 오류 상태면 OAuth 이동을 막는다', async () => {
    listCareersMock.mockResolvedValue([{ id: 'car_1', revision: 4, lastSyncedRevision: 4 }]);
    getStateMock.mockReturnValue({ kind: 'FAILED', error: { code: 'UNKNOWN', message: '실패' } });
    await expect(prepareGoogleConnect()).resolves.toMatchObject({ ok: false });
  });
});
