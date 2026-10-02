// T-11-042 스토어 앱 업데이트 안내. 서버가 알려 준 플랫폼별 최소 버전보다 이 앱이 낮으면 스토어 주소를 돌려준다.
import type { AppVersionResponse } from '@offside/contracts';
import { cachedGet } from './client.js';

/** 켤 때·돌아올 때 묻는다. 서버 응답 캐시(max-age=300)와 같은 5분 안에서는 받아 둔 값을 쓴다. */
export const fetchAppVersion = () => cachedGet<AppVersionResponse>('/v1/app/version', 5 * 60_000);

/** `1.2.3` 꼴 버전 비교(a < b면 음수). 모자란 자리는 0으로 본다. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number),
    pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** 스토어 업데이트가 필요하면 그 플랫폼의 스토어 주소, 아니면 null. 이 앱 버전을 모르면(읽지 못함) 안내하지 않는다. */
export function storeUpdateUrl(
  v: AppVersionResponse,
  platform: 'ios' | 'android',
  current: string | undefined,
): string | null {
  if (!current || !/^\d+(\.\d+)*$/.test(current)) return null;
  const s = v[platform];
  return compareVersions(current, s.min) < 0 ? s.url : null;
}
