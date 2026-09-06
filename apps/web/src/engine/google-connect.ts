import { getAppEngine } from './engine.js';
import { getSyncClient } from './sync.js';

export type GoogleConnectPreparation = { ok: true } | { ok: false; message: string };

/** OAuth로 페이지를 떠나기 전에 모든 로컬 진행이 현재 익명 프로필에 저장됐는지 확인한다. */
export async function prepareGoogleConnect(): Promise<GoogleConnectPreparation> {
  try {
    const sync = await getSyncClient();
    await sync.flush();
    const engine = await getAppEngine();
    const records = await engine.client.listCareers();
    if (
      records.every(
        (record) =>
          record.revision <= record.lastSyncedRevision && sync.getState(record.id).kind === 'IDLE',
      )
    )
      return { ok: true };
    return {
      ok: false,
      message:
        '아직 서버에 저장되지 않은 진행이 있습니다. 저장 상태를 확인한 뒤 다시 시도해 주세요.',
    };
  } catch {
    return {
      ok: false,
      message: '진행을 서버에 저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.',
    };
  }
}
