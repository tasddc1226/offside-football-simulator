import { describe, expect, it } from 'vitest';
import { hallDotLabel, hallSeason } from './hallEntry';
import { lineupOf } from './market';
import type { OwnerTeamResponse } from '@offside/contracts';

describe('T-11-604 명예관 결산 알림', () => {
  it('안 본 결산이 있을 때만 점을 띄우고, 없으면 시즌을 묻지 않는다', async () => {
    expect(hallDotLabel(false)).toBeNull();
    expect(hallDotLabel(true)).toBeTruthy();
    expect(await hallSeason(false)).toBeNull();
  });
});

describe('T-11-604 판매 · 방출 · 카드 과제를 막는 선수', () => {
  const slot = (careerId: string | null) => ({ careerId }) as never;
  const data = (presets: unknown) =>
    ({
      season: 2,
      current: 2,
      team: {
        slots: [slot('a'), slot(null)],
        presets,
      },
    }) as unknown as OwnerTeamResponse;

  it('선발과 컵 명단 프리셋 선수를 함께 막는다', () => {
    const cup = { name: '컵', formation: '4-3-3', slots: ['b', null], layout: null, cup: true };
    const other = { name: '연습', formation: '4-3-3', slots: ['c', null], layout: null };
    expect([...lineupOf(data([cup, other]))].sort()).toEqual(['a', 'b']);
    expect([...lineupOf(data(undefined))]).toEqual(['a']);
  });

  it('지난 시즌 팀은 막지 않는다', () => {
    expect(lineupOf({ ...data([]), season: 1 } as OwnerTeamResponse).size).toBe(0);
  });
});
