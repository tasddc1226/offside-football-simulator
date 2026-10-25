import { EXCHANGE_POOL } from '@offside/contracts/card-exchange-rules';
import { describe, expect, it } from 'vitest';
import { exchangeChecklist, exchangeName } from './exchange.js';
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
