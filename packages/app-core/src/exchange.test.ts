import { EXCHANGE_POOL } from '@offside/contracts/card-exchange-rules';
import { describe, expect, it } from 'vitest';
import {
  exchangeChecklist,
  exchangeFitCount,
  exchangeName,
  exchangeRecommend,
} from './exchange.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';
import { setLocale } from './i18n/core.js';

const text = (rule: Parameters<typeof exchangeChecklist>[0]) =>
  exchangeChecklist(rule, []).map((c) => c.text);

describe('카드 과제 조건 문구 (T-11-374d)', () => {
  it('포지션 구성은 약어 대신 포지션 이름으로 쓴다', () => {
    expect(text({ count: 4, shape: { DF: 2, MF: 2 } })).toEqual([
      '선수 4명',
      '수비수 2명 · 미드필더 2명',
    ]);
    try {
      setLocale('en', en);
      expect(text({ count: 4, shape: { DF: 2, MF: 2 } })[1]).toBe('Defender ×2 · Midfielder ×2');
      setLocale('ja', ja);
      expect(text({ count: 4, shape: { DF: 2, MF: 2 } })[1]).not.toMatch(/DF|MF|[가-힣]/);
    } finally {
      setLocale('ko');
    }
  });

  it('세부 포지션 · 같은 리그 · 다른 국적 문구, 모든 과제에 이름이 있다', () => {
    expect(text({ count: 2, dpos: ['CB', 'SW'] })[1]).toBe('센터백 · 스위퍼만');
    expect(text({ count: 4, sameLeague: true, distinctNations: true }).slice(1)).toEqual([
      '모두 가장 오래 뛴 리그가 같은 선수',
      '모두 다른 국적',
    ]);
    for (const s of Object.values(EXCHANGE_POOL).flat())
      expect(exchangeName(s.key)).not.toBe(s.key);
    try {
      setLocale('en', en);
      expect(text({ count: 2, dpos: ['LW', 'RW'] })[1]).not.toMatch(/[가-힣]/);
    } finally {
      setLocale('ko');
    }
  });
});

describe('카드 과제 추천 조합 (T-11-499)', () => {
  const card = (n: number, pos: 'FW' | 'MF', cardValue: number) => ({
    careerId: `c${n}`,
    pos,
    nation: 'KR',
    peak: 70,
    legendScore: 0,
    season: 1,
    foot: null,
    dpos: null,
    league: null,
    cardValue,
  });
  const def = (id: string, count: number, pos?: ('FW' | 'MF')[]) =>
    ({ id, key: id, tier: 'easy', rule: { count, ...(pos ? { pos } : {}) }, endsAt: '' }) as never;

  it('많이 내는 과제부터 겹치지 않게, 가치 낮은 선수부터 고른다', () => {
    const cards = [card(1, 'FW', 5), card(2, 'FW', 1), card(3, 'MF', 2), card(4, 'MF', 9)];
    const recs = exchangeRecommend([def('fw', 1, ['FW']), def('any', 3)], cards);
    expect(recs.get('any')?.map((c) => c.careerId)).toEqual(['c2', 'c3', 'c1']);
    // 남은 카드로는 공격수 과제를 못 채우니 따로 채운다.
    expect(recs.get('fw')?.map((c) => c.careerId)).toEqual(['c2']);
  });

  it('못 채우는 과제는 null, 맞는 선수 수를 센다', () => {
    const cards = [card(1, 'MF', 1)];
    expect(exchangeRecommend([def('fw', 2, ['FW'])], cards).get('fw')).toBeNull();
    expect(exchangeFitCount({ count: 2, pos: ['MF'] }, cards)).toBe(1);
  });
});
