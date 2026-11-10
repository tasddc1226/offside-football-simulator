// ───────── 대회 · 수상 이름과 리그 · 대회 로고의 계정 동기화 (웹·앱 공용, T-11-684) ─────────
// 이름표(customNames.ts)와 로고(compIcons.ts)의 정본은 이 기기 저장소다. 프로필 세션이 있으면 둘을 한 묶음으로 서버
// (/v1/comp-custom)와 최신 쓰기 우선으로 맞춘다 — 구단 꾸미기(clubCustom.ts)와 같은 규칙이다. 세션이 없거나 오프라인이면
// 이 기기에만 남고, 다음 부팅 · 다음 변경 때 다시 맞춘다. 맞춘 시각과 못 보낸 변경 여부는 ft_comp_custom_sync에 둔다.
import { loadKey, saveKey } from '@offside/game/storage';
import { apiFetch, hasSessionHint } from './api/client.js';
import type { ClubSyncStatus } from './clubCustom.js';
import type { CompIconMap } from './compIcons.js';
import type { CustomNameMap } from './customNames.js';
import { clubSyncText } from './i18n/ko/clubSync.js';

export const COMP_CUSTOM_SYNC_KEY = 'ft_comp_custom_sync';
const PUSH_DELAY_MS = 1500;

/** 'full'은 쓰지 않는다 — 기기 저장 한도와 서버 한도가 같다. */
export interface CompCustomSyncState {
  status: ClubSyncStatus;
}
export const initialCompCustomSyncState = (): CompCustomSyncState => ({ status: 'local' });
/** 설정 화면이 상태마다 보여 주는 안내(웹·앱 공용, 구단 꾸미기와 같은 문구). 읽을 때 지금 언어로 고른다. */
export const compSyncText = (status: ClubSyncStatus): string =>
  status === 'local'
    ? clubSyncText.syncLocal
    : status === 'syncing'
      ? clubSyncText.syncSyncing
      : status === 'synced'
        ? clubSyncText.syncSynced
        : clubSyncText.syncError;

interface Meta {
  /** 이 기기에서 마지막으로 바꾼 시각(또는 서버에서 받아 온 값의 시각). null이면 계정과 맞춘 적이 없다. */
  updatedAt: string | null;
  /** 서버에 아직 못 보낸 로컬 변경이 있다. */
  dirty: boolean;
}
type Remote = { names: CustomNameMap; icons: CompIconMap; updatedAt: string | null };

/** 이름표 · 로고의 지금 값과, 계정에서 받은 값으로 바꾸는 함수(저장하지 못하면 false). */
export interface CompCustomSource {
  names(): CustomNameMap;
  icons(): CompIconMap;
  adoptNames(map: CustomNameMap): boolean;
  adoptIcons(map: CompIconMap): boolean;
}

export function createCompCustomSync(state: CompCustomSyncState, src: CompCustomSource) {
  let meta: Meta | null = null;
  const hasLocal = () => Object.keys(src.names()).length + Object.keys(src.icons()).length > 0;

  function readMeta(): Meta {
    if (meta) return meta;
    const raw = loadKey<unknown>(COMP_CUSTOM_SYNC_KEY);
    const o = raw && typeof raw === 'object' ? (raw as Partial<Meta>) : {};
    meta = { updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null, dirty: !!o.dirty };
    return meta;
  }
  function writeMeta(next: Meta) {
    meta = next;
    saveKey(COMP_CUSTOM_SYNC_KEY, next);
  }

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  /** 유저가 이름이나 로고를 바꿨다 — 잠시 뒤 서버로 보낸다. */
  function markCompCustomDirty(): void {
    writeMeta({ updatedAt: new Date().toISOString(), dirty: true });
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), PUSH_DELAY_MS);
  }

  function fail(code: string) {
    state.status = code === 'PROFILE_REQUIRED' ? 'local' : 'error';
  }
  /** 받은 값으로 바꾼다. 기기에 저장하지 못하면 맞춘 시각을 올리지 않는다(다음에 다시 받는다). */
  function replace(remote: Remote, next: Meta): boolean {
    if (!src.adoptNames(remote.names) || !src.adoptIcons(remote.icons)) return false;
    writeMeta(next);
    return true;
  }
  /** 서버가 돌려준 값이 로컬보다 새로우면(다른 기기의 변경) 그걸로 바꾼다. */
  function adopt(remote: Remote): boolean {
    if (!remote.updatedAt || remote.updatedAt === readMeta().updatedAt) return true;
    return replace(remote, { updatedAt: remote.updatedAt, dirty: false });
  }

  async function push(): Promise<void> {
    pushTimer = null;
    const sent = readMeta().updatedAt;
    if (!readMeta().dirty || !sent) return;
    // 프로필 세션이 있었던 적 없는 기기는 묻지 않는다(401만 돌아온다). dirty는 남아 로그인 뒤 첫 맞춤 때 보낸다.
    if (!hasSessionHint()) return void (state.status = 'local');
    state.status = 'syncing';
    const r = await apiFetch<Remote>('/v1/comp-custom', {
      method: 'PUT',
      body: JSON.stringify({ names: src.names(), icons: src.icons(), updatedAt: sent }),
    });
    if (!r.ok) return fail(r.error.code);
    // 보내는 사이 또 바뀌었으면 dirty를 남겨 다음 push가 보낸다.
    if (readMeta().updatedAt === sent) writeMeta({ updatedAt: sent, dirty: false });
    state.status = adopt(r.data) ? 'synced' : 'error';
  }

  /** 부팅 때(로그인 복귀 포함) 한 번. 세션이 없으면 조용히 로컬 모드로 둔다(프로필을 새로 만들지 않는다). */
  async function syncCompCustom(): Promise<void> {
    state.status = 'syncing';
    const m = readMeta();
    // 마지막으로 맞춘 시각을 보내면 서버는 바뀐 게 없을 때 비워 보낸다 — updatedAt이 같아 adopt가 쓰지 않는다.
    const since = m.updatedAt ? `?since=${encodeURIComponent(m.updatedAt)}` : '';
    const r = await apiFetch<Remote>(`/v1/comp-custom${since}`, { method: 'GET' });
    if (!r.ok) return fail(r.error.code);
    const remote = r.data;
    if (!m.updatedAt) {
      // 이 기기는 계정과 맞춘 적이 없다(동기화가 생기기 전에 바꿨거나 로그인 전에 바꿨다).
      if (!remote.updatedAt) {
        if (!hasLocal()) return void (state.status = 'synced');
        writeMeta({ updatedAt: new Date().toISOString(), dirty: true });
        return push();
      }
      // 계정에 이미 값이 있으면 어느 쪽도 버리지 않게 합친다 — 같은 항목은 계정 값이 이긴다.
      const names = { ...src.names(), ...remote.names };
      const icons = { ...src.icons(), ...remote.icons };
      const extra =
        Object.keys(names).length > Object.keys(remote.names).length ||
        Object.keys(icons).length > Object.keys(remote.icons).length;
      const next = extra
        ? { updatedAt: new Date().toISOString(), dirty: true }
        : { updatedAt: remote.updatedAt, dirty: false };
      if (!replace({ names, icons, updatedAt: remote.updatedAt }, next))
        return void (state.status = 'error');
      if (extra) return push();
      return void (state.status = 'synced');
    }
    if (m.dirty && (!remote.updatedAt || m.updatedAt >= remote.updatedAt)) return push();
    state.status = adopt(remote) ? 'synced' : 'error';
  }

  return { markCompCustomDirty, syncCompCustom };
}
