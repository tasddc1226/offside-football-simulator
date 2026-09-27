// 공개 명예의 전당의 선수 한 명을 워커에서 읽는다(공유 링크 미리보기 메타·카드). 게임 코드를 끌어오지 않는다.
import type { PublicHofEntry } from '@offside/contracts';
import { resolveApiBaseUrl } from './api/base-url.js';

/** API가 없거나(로컬·미등록 호스트) 늦거나 실패하면 null. */
export async function fetchHofEntry(id: string, hostname: string): Promise<PublicHofEntry | null> {
  try {
    const res = await fetch(`${resolveApiBaseUrl(undefined, hostname)}/v1/hof/${id}`, {
      signal: AbortSignal.timeout(2000),
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { entry?: PublicHofEntry } };
    return body.data?.entry ?? null;
  } catch {
    return null;
  }
}
