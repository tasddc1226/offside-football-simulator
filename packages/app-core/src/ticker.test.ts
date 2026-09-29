import { describe, expect, it } from 'vitest';
import type { TickerFirst, TickerTransfer } from '@offside/contracts';
import { tickerItems } from './ticker.js';

const t = (i: number, over: Partial<TickerTransfer> = {}): TickerTransfer => ({
  at: `2026-09-29T10:${String(59 - i).padStart(2, '0')}:00.000Z`,
  name: null,
  pos: 'FW',
  number: null,
  age: 24,
  fromClubId: 'k1-2',
  toClubId: `pl-${i}`,
  ...over,
});
const f = (i: number, over: Partial<TickerFirst> = {}): TickerFirst => ({
  at: `2026-09-2${i}T00:00:00.000Z`,
  kind: 'first',
  id: `f${i}`,
  label: '발롱도르 최초 수상!',
  value: null,
  unit: null,
  name: '도하람',
  pos: 'MF',
  number: 8,
  ...over,
});

describe('홈 전광판 줄 (T-10-122)', () => {
  it('이적 3줄마다 기록 1줄을 섞고, 남은 기록은 뒤에 붙인다', () => {
    const items = tickerItems({
      transfers: [0, 1, 2, 3, 4, 5, 6].map((i) => t(i)),
      firsts: [f(1), f(2), f(3)],
    });
    expect(items.map((x) => x.kind[0])).toEqual(['t', 't', 't', 'f', 't', 't', 't', 'f', 't', 'f']);
  });

  it('이적이 없으면 기록만, 기록이 없으면 이적만', () => {
    expect(tickerItems({ transfers: [], firsts: [f(1)] })).toHaveLength(1);
    expect(tickerItems({ transfers: [t(0)], firsts: [] })).toHaveLength(1);
  });

  it('아마추어(고교·대학)에서 오면 프로 입단, 이름이 없으면 익명, 신기록은 값과 단위를 붙인다', () => {
    const [debut, move, rec] = tickerItems({
      transfers: [t(0, { fromClubId: 'hs-3' }), t(1, { name: '김오프' })],
      firsts: [
        f(1, {
          kind: 'record',
          label: '한 시즌 최다 골',
          value: 52,
          unit: '골',
          name: null,
          pos: 'FW',
          number: null,
        }),
      ],
    });
    expect(debut).toMatchObject({ kind: 'debut', who: '익명의 공격수' });
    expect(move).toMatchObject({ kind: 'transfer', who: '김오프' });
    expect(rec).toMatchObject({ kind: 'record', text: '한 시즌 최다 골 52골' });
  });
});
