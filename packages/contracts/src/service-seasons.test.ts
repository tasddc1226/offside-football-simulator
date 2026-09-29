import { describe, expect, it } from 'vitest';
import { HofSeasonQuerySchema } from './careers.js';
import {
  activeSeason,
  openTeamSeasons,
  SERVICE_SEASONS,
  teamSeasonAt,
  teamSeasonClosed,
  teamSeasonName,
} from './service-seasons.js';

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

describe('T-10-092 팀 시즌', () => {
  const S1 = SERVICE_SEASONS[0]!.startsAt;
  it('개막 전은 프리시즌(0), 개막 뒤는 시즌 id', () => {
    expect(teamSeasonAt('2026-09-30T00:00:00.000Z')).toBe(0);
    expect(teamSeasonAt(S1)).toBe(1);
    expect(openTeamSeasons('2026-09-30T00:00:00.000Z')).toEqual([0]);
    expect(openTeamSeasons(S1)).toEqual([0, 1]);
    expect([teamSeasonName(0), teamSeasonName(1)]).toEqual(['프리시즌', '시즌 1']);
  });
  it('프리시즌은 첫 시즌 개막에 끝나고, 마감이 없는 시즌은 끝나지 않는다', () => {
    expect(teamSeasonClosed(0, '2026-09-30T00:00:00.000Z')).toBe(false);
    expect(teamSeasonClosed(0, S1)).toBe(true);
    expect(teamSeasonClosed(1, '2030-01-01T00:00:00.000Z')).toBe(false);
  });
});
