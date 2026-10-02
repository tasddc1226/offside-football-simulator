import { describe, expect, it } from 'vitest';
import {
  deviceSeasonOf,
  emptySeasonText,
  myDefaultSeason,
  mySeasonOptions,
  serverSeasonOf,
} from './mySeason.js';

const PRE = '2026-09-30T00:00:00.000Z';
const S1 = '2026-10-10T00:00:00.000Z';

describe('내 선수 시즌 거르기 (T-11-029)', () => {
  it('계정 항목: 값이 없거나 null이면 프리시즌', () => {
    expect(serverSeasonOf({})).toBe(0);
    expect(serverSeasonOf({ season: null })).toBe(0);
    expect(serverSeasonOf({ season: 1 })).toBe(1);
  });

  it('기기 기록: 받아 둔 값 > 업로드 대기 중이면 지금 시즌 > 옛 기록은 프리시즌', () => {
    const none = new Set<string>();
    expect(deviceSeasonOf({ id: 'a', season: 0 }, new Set(['a']), S1)).toBe(0);
    expect(deviceSeasonOf({ id: 'a', season: 1 }, none, S1)).toBe(1);
    expect(deviceSeasonOf({ id: 'a' }, new Set(['a']), S1)).toBe(1);
    expect(deviceSeasonOf({ id: 'a' }, none, S1)).toBe(0);
    expect(deviceSeasonOf({}, none, S1)).toBe(0);
  });

  it('시즌 선택지와 기본값', () => {
    expect(mySeasonOptions(PRE)).toEqual([{ id: 0, name: '프리시즌' }]);
    expect(mySeasonOptions(S1)).toEqual([
      { id: 0, name: '프리시즌' },
      { id: 1, name: '시즌 1' },
    ]);
    expect(myDefaultSeason(PRE)).toBe(0);
    expect(myDefaultSeason(S1)).toBe(1);
  });

  it('빈 시즌 안내는 다른 시즌에 있는 선수 수를 알려 준다', () => {
    expect(emptySeasonText(1, 3)).toContain('시즌 1에 은퇴한 선수가 아직 없어요');
    expect(emptySeasonText(1, 3)).toContain('3명');
    expect(emptySeasonText(0, 0)).toContain('은퇴까지 마치면');
  });
});
