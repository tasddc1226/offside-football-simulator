import { afterEach, describe, expect, it } from 'vitest';
import {
  passEntryOpen,
  passRewardBetween,
  passSaleOpen,
  passSaleSeason,
  passSeasonFor,
  passTierOf,
  SEASON_PASS_TIERS,
} from './season-pass-rules';
import { applySeasonSchedule } from './service-seasons';

describe('T-11-511 시즌 패스 규칙', () => {
  afterEach(() => applySeasonSchedule([]));

  it('은퇴 수로 열린 단계 수(1단계는 사면 바로 열린다)', () => {
    expect(passTierOf(0)).toBe(1);
    expect(passTierOf(4)).toBe(4);
    expect(passTierOf(25)).toBe(11);
    expect(passTierOf(50)).toBe(SEASON_PASS_TIERS.length);
  });

  it('(from, to] 단계 보상을 합친다', () => {
    expect(passRewardBetween(0, 4)).toEqual({ reroll: 20, boost: 13, scout: 3 });
    expect(passRewardBetween(4, 4)).toEqual({});
  });

  it('진행 중인 시즌을 팔고, 시즌 사이면 다음 시즌, 이미 가졌으면 그다음 시즌', () => {
    applySeasonSchedule([
      {
        id: 1,
        startsAt: '2026-10-05T15:00:00.000Z',
        endsAt: '2026-10-30T15:00:00.000Z',
        retireAt: 45,
      },
      { id: 2, startsAt: '2026-11-01T15:00:00.000Z', endsAt: null, retireAt: 46 },
    ]);
    // 시즌 1에는 팔지 않고, 그동안 화면 · 지급 기준은 시즌 2다.
    expect(passSaleOpen('2026-10-20T00:00:00.000Z')).toBe(false);
    expect(passSaleSeason('2026-10-20T00:00:00.000Z')).toBe(2);
    expect(passSaleOpen('2026-10-31T00:00:00.000Z')).toBe(true);
    expect(passSaleSeason('2026-10-31T00:00:00.000Z')).toBe(2);
    expect(passSeasonFor('2026-11-05T00:00:00.000Z', [2])).toBe(3);
  });

  it('T-11-519 패스 입구는 출시 뒤에도 시즌 2 일정이 들어와 개막해야 보인다', () => {
    // 시즌 2 일정을 아직 받지 못했으면 시즌 1이 이어지는 것으로 보고 숨긴다.
    expect(passEntryOpen('2026-11-05T00:00:00.000Z', true)).toBe(false);
    applySeasonSchedule([
      {
        id: 1,
        startsAt: '2026-10-05T15:00:00.000Z',
        endsAt: '2026-10-30T15:00:00.000Z',
        retireAt: 45,
      },
      { id: 2, startsAt: '2026-10-30T15:00:00.000Z', endsAt: null, retireAt: 46 },
    ]);
    expect(passEntryOpen('2026-10-30T14:59:59.000Z', true)).toBe(false);
    expect(passEntryOpen('2026-10-30T15:00:00.000Z', true)).toBe(true);
    expect(passEntryOpen('2026-10-30T15:00:00.000Z', false)).toBe(false);
  });
});
