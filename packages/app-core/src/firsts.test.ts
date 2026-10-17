import { describe, expect, it } from 'vitest';
import type { ServerFirst } from '@offside/contracts';
import { kstParts } from '@offside/app-core/boardText';
import { achievedList, byDay, holderLabel } from './firsts.js';
import { recentDays, seriesKey, seriesList, topHolders } from './firstsSeries.js';

const f = (id: string, achievedAt: string | null): ServerFirst => ({
  id,
  cat: 'total',
  label: id,
  achievedAt,
  holder: achievedAt ? { careerId: `c-${id}`, name: null, pos: 'GK', number: 1 } : null,
});

describe('서버 최초 기록 화면 계산 (T-10-027)', () => {
  it('한국 시간 기준으로 날짜·시각을 만든다', () => {
    expect(kstParts('2026-09-24T15:30:00.000Z')).toEqual({ day: '26.09.25', time: '00:30' });
    expect(kstParts('2026-12-31T14:59:00.000Z')).toEqual({ day: '26.12.31', time: '23:59' });
  });

  it('달성된 기록만 최근 순으로, 같은 한국 날짜끼리 묶는다', () => {
    const list = achievedList([
      f('a', '2026-09-24T10:00:00.000Z'),
      f('b', null),
      f('c', '2026-09-24T16:00:00.000Z'),
      f('d', '2026-09-25T02:00:00.000Z'),
    ]);
    expect(list.map((x) => x.id)).toEqual(['d', 'c', 'a']);
    expect(byDay(list).map((g) => [g.day, g.items.map((x) => x.id)])).toEqual([
      ['26.09.25', ['d', 'c']],
      ['26.09.24', ['a']],
    ]);
  });

  it('내 선수는 이 기기의 이름, 아니면 공개 이름 또는 익명', () => {
    const h = { careerId: 'x', name: null, pos: 'GK' as const, number: 1 };
    expect(holderLabel(h, new Map([['x', '홍길동']]))).toEqual({ name: '홍길동', mine: true });
    expect(holderLabel({ ...h, name: '김오프' }, new Map())).toEqual({
      name: '김오프',
      mine: false,
    });
    expect(holderLabel(h, new Map()).name).toBe('익명의 골키퍼 No.1');
  });

  it('T-11-335 단계 기록은 묶음 키가 같은 이웃끼리 한 줄로, 가장 높은 단계 · 다음 목표를 낸다', () => {
    expect(seriesKey('goals150')).toBe('goals');
    expect(seriesKey('ballon1')).toBe('ballon');
    expect(seriesKey('ucl')).toBe('ucl');
    const s = seriesList([
      f('goals100', '2026-09-24T10:00:00.000Z'),
      f('goals150', '2026-09-24T11:00:00.000Z'),
      f('goals200', null),
      f('ucl', null),
      f('ballon1', '2026-09-24T12:00:00.000Z'),
    ]);
    expect(
      s.map((x) => [x.key, x.steps.length, x.top?.id ?? null, x.next?.id ?? null, x.done]),
    ).toEqual([
      ['goals', 3, 'goals150', 'goals200', 2],
      ['ucl', 1, null, 'ucl', 0],
      ['ballon', 1, 'ballon1', null, 1],
    ]);
  });

  it('T-11-335 최근 기록은 그날 같은 선수 · 같은 기록의 단계를 가장 높은 단계 한 줄로 묶는다', () => {
    const same = { careerId: 'c1', name: null, pos: 'FW' as const, number: 9 };
    const g = (id: string, at: string): ServerFirst => ({ ...f(id, at), holder: same });
    const days = recentDays(
      achievedList([
        g('legend840', '2026-09-24T10:00:00.000Z'),
        g('legend1000', '2026-09-24T10:00:00.000Z'),
        g('legend1100', '2026-09-24T10:00:00.000Z'),
        f('goals100', '2026-09-24T11:00:00.000Z'),
        g('legend1200', '2026-09-25T10:00:00.000Z'),
      ]),
    );
    expect(days.map((d) => [d.day, d.items.map((x) => [x.item.id, x.steps])])).toEqual([
      ['26.09.25', [['legend1200', 1]]],
      [
        '26.09.24',
        [
          ['goals100', 1],
          ['legend1100', 3],
        ],
      ],
    ]);
  });

  it('T-11-335 기록을 가장 많이 세운 선수를 개수 순으로', () => {
    const h = (c: string) => ({ careerId: c, name: null, pos: 'FW' as const, number: 9 });
    const x = (id: string, c: string): ServerFirst => ({
      ...f(id, '2026-09-24T10:00:00.000Z'),
      holder: h(c),
    });
    const top = topHolders(
      achievedList([x('a', 'p'), x('b', 'q'), x('c', 'q'), x('d', 'r'), x('e', 'q')]),
      2,
    );
    expect(top.map((t) => [t.holder.careerId, t.count])).toEqual([
      ['q', 3],
      ['p', 1],
    ]);
  });
});
