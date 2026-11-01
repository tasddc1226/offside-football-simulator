import { afterEach, describe, expect, it } from 'vitest';
import { applySeasonSchedule } from '@offside/contracts/service-seasons';
import { en } from './i18n/en/index.js';
import { setLocale } from './i18n/core.js';
import { seasonChoices } from './seasonPick.js';

const S1_END = '2026-10-30T15:00:00.000Z'; // 10-31 00:00 KST

describe('seasonChoices (T-11-562)', () => {
  afterEach(() => {
    applySeasonSchedule([]);
    setLocale('ko');
  });

  it('최신 시즌이 위, 프리시즌은 맨 아래이고 기간 · 상태를 붙인다', () => {
    applySeasonSchedule([
      { id: 1, startsAt: '2026-10-05T15:00:00.000Z', endsAt: S1_END, retireAt: 45 },
      { id: 2, startsAt: S1_END, endsAt: null, retireAt: 45 },
    ]);
    const list = seasonChoices([0, 1, 2], '2026-11-02T00:00:00.000Z');
    expect(list.map((c) => c.id)).toEqual([2, 1, 0]);
    expect(list.map((c) => c.row)).toEqual([
      '시즌 2 · 10.31 ~ · 진행 중',
      '시즌 1 · 10.06 ~ 10.30 · 마감',
      '프리시즌 · ~ 10.05 · 마감',
    ]);
    expect(list[0]!.face).toBe('시즌 2 · 진행 중');
    expect(list[1]!.face).toBe('시즌 1');
    expect(list[1]!.detail).toBe('10.06 ~ 10.30 · 마감');
  });

  it('개막 전 시즌은 개막 예정, 서버 이름 목록과 중복 id도 받는다', () => {
    const list = seasonChoices(
      [{ id: 1, name: '시즌 1' }, { id: 1 }, { id: 0, name: '프리시즌' }],
      '2026-10-01T00:00:00.000Z',
    );
    expect(list.map((c) => c.id)).toEqual([1, 0]);
    expect(list[0]).toMatchObject({
      status: 'upcoming',
      tag: '개막 예정',
      face: '시즌 1 · 개막 예정',
    });
  });

  it('언어를 따른다', () => {
    setLocale('en', en);
    const [s1] = seasonChoices([1], '2026-10-10T00:00:00.000Z');
    expect(s1!.row).toBe('Season 1 · 10.06 ~ · Live');
  });
});
