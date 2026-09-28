import { describe, expect, it } from 'vitest';
import { HofSeasonQuerySchema } from './careers.js';
import { activeSeason, SERVICE_SEASONS } from './service-seasons.js';

describe('서비스 시즌 (T-10-090)', () => {
  const s1 = SERVICE_SEASONS[0]!;

  it('시즌 1은 2026-10-06 0시(KST)에 열린다', () => {
    expect(s1.startsAt).toBe('2026-10-05T15:00:00.000Z');
  });

  it('개막 전은 프리시즌, 개막 시각부터 진행 중', () => {
    expect(activeSeason('2026-10-05T14:59:59.999Z')).toBeUndefined();
    expect(activeSeason('2026-10-05T15:00:00.000Z')?.id).toBe(1);
  });

  it('시즌 쿼리는 있는 시즌만 받는다', () => {
    expect(HofSeasonQuerySchema.parse(undefined)).toBeUndefined();
    expect(HofSeasonQuerySchema.parse('1')).toBe(s1);
    expect(HofSeasonQuerySchema.safeParse('99').success).toBe(false);
    expect(HofSeasonQuerySchema.safeParse('x').success).toBe(false);
  });
});
