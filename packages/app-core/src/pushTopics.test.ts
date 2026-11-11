import { describe, expect, it } from 'vitest';
import { PUSH_TOPICS } from '@offside/contracts';
import {
  DEFAULT_PUSH_PICKS,
  GROUP_TOPICS,
  pickedGroups,
  pickerGroups,
  picksToTopics,
  topicsFromLegacy,
} from './pushTopics';

describe('push topic groups', () => {
  it('모든 주제가 묶음 하나에만 들어 있다', () => {
    const all = Object.values(GROUP_TOPICS).flat();
    expect([...all].sort()).toEqual([...PUSH_TOPICS].sort());
  });
  it('선택 창 처음 값은 출석 · 복귀만 끈다', () => {
    expect(picksToTopics(DEFAULT_PUSH_PICKS)).toEqual({
      match: true,
      cup: true,
      league: true,
      market: true,
      friend: true,
      reward: true,
      notice: true,
      release: true,
      attendance: false,
      comeback: false,
    });
    expect(pickedGroups(DEFAULT_PUSH_PICKS)).toBe('game,market,social,news');
  });
  it('권유가 뜬 자리의 묶음을 맨 위에 올리고 나머지 순서는 그대로 둔다', () => {
    expect(pickerGroups('sell')).toEqual(['market', 'game', 'social', 'news', 'nudge']);
    expect(pickerGroups('cup')[0]).toBe('game');
    expect(pickerGroups('home')).toEqual(['game', 'market', 'social', 'news', 'nudge']);
  });
  it('옛 설정 모양을 주제 모양으로 읽는다', () => {
    expect(topicsFromLegacy({ team: false, social: true, nudge: false })).toMatchObject({
      match: false,
      cup: false,
      league: false,
      friend: true,
      reward: true,
      attendance: false,
      comeback: false,
      notice: true,
    });
  });
});
