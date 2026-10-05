import { describe, expect, it } from 'vitest';
import { HofSeasonQuerySchema, SeasonPickQuerySchema } from './careers.js';
import {
  activeSeason,
  displaySeasonAt,
  firstUploadSeasonAt,
  openTeamSeasons,
  PRESEASON,
  MAX_RETIRE_AT,
  nextRetireAt,
  PRESEASON_RETIRE_AT,
  previewSeasonAt,
  RETIRE_AT_LIMIT,
  retireAtNow,
  retireAtOf,
  seasonById,
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
    // T-11-029 0은 프리시즌(마감 없음).
    expect(HofSeasonQuerySchema.parse('0')).toBe(PRESEASON);
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
    expect([teamSeasonName(0, 'en'), teamSeasonName(1, 'en')]).toEqual(['Preseason', 'Season 1']);
    expect(teamSeasonName(1, 'ko')).toBe('시즌 1');
  });
  it('프리시즌은 첫 시즌 개막에 끝나고, 마감이 없는 시즌은 끝나지 않는다', () => {
    expect(teamSeasonClosed(0, '2026-09-30T00:00:00.000Z')).toBe(false);
    expect(teamSeasonClosed(0, S1)).toBe(true);
    expect(teamSeasonClosed(1, '2030-01-01T00:00:00.000Z')).toBe(false);
  });
});

describe('T-11-029 시즌별 기록의 기본 시즌', () => {
  const S1 = SERVICE_SEASONS[0]!.startsAt;
  it('개막 전은 프리시즌(0), 개막 뒤는 시즌 id — 휴식기엔 마지막 시즌', () => {
    expect(displaySeasonAt('2026-09-30T00:00:00.000Z')).toBe(0);
    expect(displaySeasonAt(S1)).toBe(1);
    expect(seasonById(0)).toBe(PRESEASON);
    expect(seasonById(1)).toBe(SERVICE_SEASONS[0]);
    expect(seasonById(9)).toBeUndefined();
  });
  it('홈 명예의 전당 미리보기는 개막 전엔 시즌 없이(= 프리시즌 전체), 개막 뒤엔 지금 시즌', () => {
    expect(previewSeasonAt('2026-09-30T00:00:00.000Z')).toBeNull();
    expect(previewSeasonAt(S1)).toBe(1);
  });
  it('?season= 쿼리는 프리시즌(0)과 있는 시즌만 받는다', () => {
    expect(SeasonPickQuerySchema.parse(undefined)).toBeUndefined();
    expect(SeasonPickQuerySchema.parse('0')).toBe(0);
    expect(SeasonPickQuerySchema.parse('1')).toBe(1);
    expect(SeasonPickQuerySchema.safeParse('9').success).toBe(false);
    expect(SeasonPickQuerySchema.safeParse('-1').success).toBe(false);
  });
});

describe('T-11-045 시즌별 은퇴 나이', () => {
  const open = SERVICE_SEASONS[0]!.startsAt;
  it('프리시즌(0·NULL)은 41세, 시즌 1은 45세', () => {
    expect(retireAtOf(0)).toBe(PRESEASON_RETIRE_AT);
    expect(retireAtOf(null)).toBe(41);
    expect(retireAtOf(1)).toBe(45);
    expect(retireAtOf(99)).toBe(41);
  });
  it('새 선수는 개막 전이면 41세, 개막부터 45세', () => {
    expect(retireAtNow('2026-10-05T14:59:59.999Z')).toBe(41);
    expect(retireAtNow(open)).toBe(45);
  });
  it('다음 시즌 은퇴 나이는 누가 은퇴 나이까지 뛰었으면 +1, 아니면 그대로, 59세에서 멈춘다', () => {
    expect(nextRetireAt(45, true)).toBe(46);
    expect(nextRetireAt(46, false)).toBe(46);
    expect(nextRetireAt(58, true)).toBe(59);
    expect(nextRetireAt(RETIRE_AT_LIMIT, true)).toBe(59);
  });
  it('시즌 정의는 해금 규칙을 지킨다 — 시즌 1은 45세, 시즌마다 그대로거나 +1, 59세 이하', () => {
    expect(SERVICE_SEASONS[0]!.retireAt).toBe(45);
    // 시즌 2부터 — 새 시즌을 더할 때 은퇴 나이를 잘못 적으면 여기서 막힌다.
    SERVICE_SEASONS.slice(1).forEach((s, i) => {
      const prev = SERVICE_SEASONS[i]!.retireAt;
      expect([prev, nextRetireAt(prev, true)]).toContain(s.retireAt);
    });
    expect(MAX_RETIRE_AT).toBe(45);
  });
  it('T-11-095 세부 포지션 없는(프리시즌 규칙) 선수는 언제 처음 올라와도 프리시즌, 있으면 올라온 시각의 시즌', () => {
    expect(firstUploadSeasonAt('2026-10-20T00:00:00.000Z', false)).toBe(0);
    expect(firstUploadSeasonAt('2026-10-20T00:00:00.000Z', true)).toBe(1);
    // 기기 시계를 당겨 개막 전에 올려도 시즌 1에 먼저 들어가지 않는다.
    expect(firstUploadSeasonAt('2026-10-05T14:59:59.999Z', true)).toBe(0);
  });
});
