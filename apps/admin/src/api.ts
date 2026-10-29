// T-11-572 지표 API. 세션 쿠키(api.offside-lab.com 호스트 전용, SameSite=Lax)는 같은 사이트인 admin 주소에서도 실린다.
import type { KpiReport } from '@offside/contracts';

const API =
  location.hostname === 'admin.offside-lab.com'
    ? 'https://api.offside-lab.com'
    : ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787');

export type KpiResult =
  { ok: true; data: KpiReport } | { ok: false; status: number; message: string };

export async function fetchKpi(days: number): Promise<KpiResult> {
  try {
    const res = await fetch(`${API}/v1/admin/kpi?days=${days}`, { credentials: 'include' });
    const body = (await res.json().catch(() => null)) as {
      data?: KpiReport;
      error?: { message?: string };
    } | null;
    if (res.ok && body?.data) return { ok: true, data: body.data };
    return { ok: false, status: res.status, message: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, message: String(e) };
  }
}

/** 게임 웹(로그인하는 곳). */
export const GAME_URL =
  location.hostname === 'admin.offside-lab.com'
    ? 'https://offside-lab.com/settings'
    : 'http://localhost:5173/settings';
