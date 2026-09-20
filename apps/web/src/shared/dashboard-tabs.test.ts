// UX-014 사용자 결정(2026-09-14): 5탭(홈·일정·선수·계약·기록) → 4탭(시즌·커리어·선수·우승 연혁)
// 재편에 따른 옛 URL(`?view=schedule` 등) 호환 매핑 1건.
import { describe, expect, it } from 'vitest';
import { normalizeDashboardTab } from './dashboard-tabs.js';

describe('normalizeDashboardTab', () => {
  it('새 4탭 값은 그대로 통과한다', () => {
    expect(normalizeDashboardTab('season')).toBe('season');
    expect(normalizeDashboardTab('career')).toBe('career');
    expect(normalizeDashboardTab('player')).toBe('player');
    expect(normalizeDashboardTab('trophies')).toBe('trophies');
  });

  it('옛 5탭 값(북마크·공유 링크)을 새 4탭으로 되돌린다', () => {
    expect(normalizeDashboardTab('home')).toBe('season');
    expect(normalizeDashboardTab('schedule')).toBe('career');
    expect(normalizeDashboardTab('contract')).toBe('career');
    expect(normalizeDashboardTab('records')).toBe('career');
  });

  it('알 수 없는 값·문자열이 아닌 값은 undefined다(호출부가 기본값 season으로 떨어진다)', () => {
    expect(normalizeDashboardTab('unknown-tab')).toBeUndefined();
    expect(normalizeDashboardTab(undefined)).toBeUndefined();
    expect(normalizeDashboardTab(42)).toBeUndefined();
  });
});
