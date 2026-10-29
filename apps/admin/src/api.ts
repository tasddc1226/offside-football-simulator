// T-11-572 운영 API. 세션 쿠키(api.offside-lab.com 호스트 전용, SameSite=Lax)는 같은 사이트인 admin 주소에서도 실린다.
// T-11-577 화면이 열릴 때만 부르고, 같은 주소는 1분 동안(또는 새로고침 전까지) 다시 부르지 않는다(실패는 기억하지 않는다).

const API =
  location.hostname === 'admin.offside-lab.com'
    ? 'https://api.offside-lab.com'
    : ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787');

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const TTL_MS = 60_000;
const memo = new Map<string, { at: number; p: Promise<ApiResult<unknown>> }>();

async function request<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API}${path}`, { credentials: 'include' });
    const body = (await res.json().catch(() => null)) as {
      data?: T;
      error?: { message?: string };
    } | null;
    if (res.ok && body?.data) return { ok: true, data: body.data };
    return { ok: false, status: res.status, message: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, message: String(e) };
  }
}

export function get<T>(path: string): Promise<ApiResult<T>> {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p as Promise<ApiResult<T>>;
  const entry = { at: Date.now(), p: null as unknown as Promise<ApiResult<unknown>> };
  entry.p = request<T>(path).then((r) => {
    // 그 사이 새로고침으로 다른 요청이 자리를 차지했으면 지우지 않는다.
    if (!r.ok && memo.get(path) === entry) memo.delete(path);
    return r;
  });
  memo.set(path, entry);
  return entry.p as Promise<ApiResult<T>>;
}

export const clearApiCache = () => memo.clear();

/** 게임 웹(로그인하는 곳). */
export const GAME_URL =
  location.hostname === 'admin.offside-lab.com'
    ? 'https://offside-lab.com'
    : 'http://localhost:5173';
