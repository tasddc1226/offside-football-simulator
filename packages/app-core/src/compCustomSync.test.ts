import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { setCustomNames } from '@offside/game/i18n/names';
import { apiFetch, hasSessionHint } from './api/client.js';
import { createCompIcons, initialCompIconsState } from './compIcons.js';
import {
  COMP_CUSTOM_SYNC_KEY,
  createCompCustomSync,
  initialCompCustomSyncState,
} from './compCustomSync.js';
import { createCustomNames, initialCustomNamesState } from './customNames.js';

vi.mock('./api/client.js', () => ({ apiFetch: vi.fn(), hasSessionHint: vi.fn() }));
const api = vi.mocked(apiFetch);
const hint = vi.mocked(hasSessionHint);

const IMG = `data:image/webp;base64,${'A'.repeat(40)}`;
const IMG2 = `data:image/png;base64,${'B'.repeat(40)}`;
type Remote = {
  names: Record<string, string>;
  icons: Record<string, string>;
  updatedAt: string | null;
};

/** 서버 흉내 — 최신 쓰기 우선, ?since=가 같으면 비워 보낸다. session이 false면 PROFILE_REQUIRED. */
let server: Remote;
let session = true;
let calls: string[];
function serve() {
  api.mockImplementation(async (path: string, init?: RequestInit) => {
    calls.push(`${init?.method} ${path.split('?')[0]}`);
    if (!session)
      return {
        ok: false,
        error: { code: 'PROFILE_REQUIRED', message: '', retryable: false },
      } as never;
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as Remote;
      if (!server.updatedAt || server.updatedAt <= body.updatedAt!) server = body;
      return { ok: true, data: server } as never;
    }
    const since = new URL(path, 'https://x.test').searchParams.get('since');
    return {
      ok: true,
      data: since && since === server.updatedAt ? { ...server, names: {}, icons: {} } : server,
    } as never;
  });
}

/** 기기 하나(저장소 · 이름표 · 로고 · 동기화). */
function device() {
  const mem = new Map<string, string>();
  const use = () =>
    setStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
  use();
  const names = initialCustomNamesState();
  const icons = initialCompIconsState();
  const state = initialCompCustomSyncState();
  const changed = () => sync.markCompCustomDirty();
  const n = createCustomNames(names, changed);
  const i = createCompIcons(icons, changed);
  const sync = createCompCustomSync(state, {
    names: () => names.map,
    icons: () => icons.map,
    adoptNames: n.adoptCustomNames,
    adoptIcons: i.adoptCompIcons,
  });
  return { mem, use, names, icons, state, n, i, sync };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-10T00:00:00.000Z'));
  server = { names: {}, icons: {}, updatedAt: null };
  session = true;
  calls = [];
  serve();
  hint.mockImplementation(() => session);
});
afterEach(() => {
  vi.useRealTimers();
  api.mockReset();
  setCustomNames({});
});

describe('대회 · 수상 이름과 리그 · 대회 로고 계정 동기화 (T-11-684)', () => {
  it('바꾸면 잠시 뒤 계정으로 보내고, 다른 기기는 부팅 때 받는다', async () => {
    const web = device();
    web.n.setCustomName('코리아컵', '오프사이드컵');
    web.i.setCompIcon('코리아컵', IMG);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls).toEqual(['PUT /v1/comp-custom']);
    expect(server.names).toEqual({ 코리아컵: '오프사이드컵' });
    expect(server.icons).toEqual({ 코리아컵: IMG });
    expect(web.state.status).toBe('synced');

    const app = device();
    await app.sync.syncCompCustom();
    expect(app.names.map).toEqual({ 코리아컵: '오프사이드컵' });
    expect(app.icons.map).toEqual({ 코리아컵: IMG });
    expect(app.state.status).toBe('synced');
    // 받은 값은 다시 올리지 않는다.
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls.filter((c) => c.startsWith('PUT'))).toHaveLength(1);
    // 다음 부팅은 since로 묻고 바뀐 게 없으면 그대로 둔다.
    await app.sync.syncCompCustom();
    expect(app.names.map).toEqual({ 코리아컵: '오프사이드컵' });
  });

  it('동기화가 생기기 전에 바꿔 둔 값은 첫 맞춤 때 올린다', async () => {
    const web = device();
    createCustomNames(web.names).setCustomName('코리아컵', '오프사이드컵');
    expect(web.mem.has(COMP_CUSTOM_SYNC_KEY)).toBe(false);
    await web.sync.syncCompCustom();
    expect(server.names).toEqual({ 코리아컵: '오프사이드컵' });
    expect(web.state.status).toBe('synced');
  });

  it('두 기기가 따로 바꿔 둔 값은 첫 맞춤 때 합친다(같은 항목은 계정 값)', async () => {
    const web = device();
    createCustomNames(web.names).setCustomName('코리아컵', '웹 컵');
    createCompIcons(web.icons).setCompIcon('코리아컵', IMG);
    await web.sync.syncCompCustom();

    vi.setSystemTime(new Date('2026-11-10T01:00:00.000Z'));
    const app = device();
    createCustomNames(app.names).setCustomName('코리아컵', '앱 컵');
    createCustomNames(app.names).setCustomName('발롱도르', '황금공');
    createCompIcons(app.icons).setCompIcon('발롱도르', IMG2);
    await app.sync.syncCompCustom();
    const merged = { 코리아컵: '웹 컵', 발롱도르: '황금공' };
    expect(app.names.map).toEqual(merged);
    expect(app.icons.map).toEqual({ 코리아컵: IMG, 발롱도르: IMG2 });
    expect(server.names).toEqual(merged);

    web.use();
    await web.sync.syncCompCustom();
    expect(web.names.map).toEqual(merged);
    expect(web.icons.map).toEqual({ 코리아컵: IMG, 발롱도르: IMG2 });
  });

  it('맞춘 뒤에는 나중에 바꾼 기기가 이긴다(되돌린 이름도 전해진다)', async () => {
    const web = device();
    web.n.setCustomName('코리아컵', '오프사이드컵');
    await vi.advanceTimersByTimeAsync(1500);
    const app = device();
    await app.sync.syncCompCustom();

    vi.setSystemTime(new Date('2026-11-10T02:00:00.000Z'));
    app.n.setCustomName('코리아컵', '');
    await vi.advanceTimersByTimeAsync(1500);
    expect(server.names).toEqual({});
    web.use();
    await web.sync.syncCompCustom();
    expect(web.names.map).toEqual({});
  });

  it('세션이 없으면 이 기기에만 두고, 오류면 다음 부팅 때 다시 보낸다', async () => {
    const web = device();
    session = false;
    web.n.setCustomName('코리아컵', '오프사이드컵');
    await vi.advanceTimersByTimeAsync(1500);
    expect(web.state.status).toBe('local');
    expect(calls).toEqual([]);
    expect(web.names.map).toEqual({ 코리아컵: '오프사이드컵' });

    session = true;
    api.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NETWORK', message: '', retryable: true },
    } as never);
    await web.sync.syncCompCustom();
    expect(web.state.status).toBe('error');
    await web.sync.syncCompCustom();
    expect(server.names).toEqual({ 코리아컵: '오프사이드컵' });
    expect(web.state.status).toBe('synced');
  });
});
