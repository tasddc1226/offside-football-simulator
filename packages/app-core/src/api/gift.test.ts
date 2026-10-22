// T-11-386 홈 선물 칸의 문구 — 시즌 업적 보상은 0장인 아이템을 문장에서 뺀다.
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { en } from '../i18n/en/index.js';
import { ja } from '../i18n/ja/index.js';
import { giftCopy } from './gift.js';

const season = (boost: number, scout: number) =>
  giftCopy({ id: 'ach-season-1', kind: 'achSeason', season: 1, boost, scout });

describe('giftCopy', () => {
  afterEach(() => setLocale('ko'));

  it('홈 선물은 두 아이템을 함께 말한다', () => {
    expect(giftCopy({ id: 'gift-2026-10', boost: 20, scout: 5 })).toEqual({
      title: '구단주 선물이 도착했어요',
      sub: '잠재력 강화권 20장과 프리미엄 스카우트권 5장을 받을 수 있어요.',
      done: '잠재력 강화권 20장과 프리미엄 스카우트권 5장을 받았어요.',
    });
  });

  it('시즌 업적 보상은 받을 아이템만 말한다', () => {
    expect(season(3, 0)).toEqual({
      title: '시즌 1 업적 보상이 도착했어요',
      sub: '시즌 1 업적으로 잠재력 강화권 3장을 받을 수 있어요.',
      done: '잠재력 강화권 3장을 받았어요.',
    });
    expect(season(10, 3).sub).toBe(
      '시즌 1 업적으로 잠재력 강화권 10장과 프리미엄 스카우트권 3장을 받을 수 있어요.',
    );
    expect(season(0, 1).done).toBe('프리미엄 스카우트권 1장을 받았어요.');
  });

  it('영어 · 일본어도 같은 규칙', () => {
    setLocale('en', en);
    expect(season(1, 0).sub).toBe('Your season 1 achievements earned 1 boost ticket.');
    expect(season(10, 3).done).toBe('You got 10 boost tickets and 3 premium scout tickets.');
    setLocale('ja', ja);
    expect(season(3, 1).sub).toBe(
      'シーズン1の実績でポテンシャル強化券3枚とプレミアムスカウト券1枚を受け取れます。',
    );
  });
});
