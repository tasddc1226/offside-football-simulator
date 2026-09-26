import { describe, expect, it } from 'vitest';
import type { ServerFirst } from '@offside/contracts';
import { kstParts } from '../boardText.js';
import { achievedList, byDay, holderLabel } from './firsts.js';

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
});
