import { describe, expect, it } from 'vitest';
import { cardAttrStrip } from './market.js';

const attrs = { pac: 91.4, sho: 88, pas: 72, dri: 80, def: 41, phy: 59.6 };

describe('cardAttrStrip (T-11-477)', () => {
  it('카드 능력치 6개를 순서대로 반올림하고, 90 이상은 강조 · 60 미만은 흐리게 둔다', () => {
    expect(cardAttrStrip({ pos: 'FW', attrs })).toEqual([
      { key: 'pac', label: '스피드', value: 91, tone: 'hi' },
      { key: 'sho', label: '슈팅', value: 88, tone: '' },
      { key: 'pas', label: '패스', value: 72, tone: '' },
      { key: 'dri', label: '드리블', value: 80, tone: '' },
      { key: 'def', label: '수비', value: 41, tone: 'lo' },
      { key: 'phy', label: '피지컬', value: 60, tone: '' },
    ]);
  });

  it('골키퍼는 골키퍼 능력치 이름을 쓰고, 능력치가 없는 옛 카드는 줄을 그리지 않는다', () => {
    const gk = cardAttrStrip({ pos: 'GK', attrs });
    expect(gk.map((a) => a.label)).not.toEqual(
      cardAttrStrip({ pos: 'FW', attrs }).map((a) => a.label),
    );
    expect(cardAttrStrip({ pos: 'DF', attrs: null })).toEqual([]);
  });
});
