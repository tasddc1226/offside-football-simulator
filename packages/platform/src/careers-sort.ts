import type { LocalCareerRecord } from '@offside/engine-client';

/** `careers.list()` 반환 순서: `updatedAt` 내림차순, 동일하면 `id` 오름차순. */
export function compareCareersDesc(a: LocalCareerRecord, b: LocalCareerRecord): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
