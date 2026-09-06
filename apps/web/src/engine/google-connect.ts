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
      records.every((record) => {
        const state = sync.getState(record.id);
        if (record.revision <= record.lastSyncedRevision && state.kind === 'IDLE') return true;
        // 로그아웃 뒤 남은 로컬 커리어는 새 guest가 원 서버 record를 소유하지 않아 403이 난다.
        // Google 재인증은 소유권을 되찾는 비파괴 경로라 이 상태만 OAuth를 허용한다.
        return (
          record.revision > record.lastSyncedRevision &&
          state.kind === 'FAILED' &&
          state.error.code === 'CAREER_NOT_OWNED'
        );
      })
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
