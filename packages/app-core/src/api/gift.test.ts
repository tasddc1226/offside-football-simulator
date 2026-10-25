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

  it('시즌 업적 보상은 받을 아이템만 말한다', () => {
    expect(season(3, 0)).toEqual({
      title: '시즌 1 업적 보상이 도착했어요',
      sub: '시즌 1 업적으로 잠재력 강화권 3장을 받을 수 있어요.',
      detail: null,
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

  const z = { reroll: 0, scout: 0, boost: 0 };
  const record = {
    id: 'rec-season-1',
    kind: 'recordSeason' as const,
    season: 1,
    reroll: 12,
    scout: 1,
    boost: 4,
    record: {
      hofRank: 13,
      icons: 2,
      legends: 3,
      ballonPlayers: 2,
      hof: { reroll: 7, scout: 1, boost: 1 },
      legend: { reroll: 0, scout: 0, boost: 2 },
      ballon: { reroll: 5, scout: 0, boost: 1 },
    },
  };

  it('T-11-487 시즌 기록 보상은 리롤권까지 말하고 받는 갈래만 내역에 적는다', () => {
    expect(giftCopy(record)).toEqual({
      title: '시즌 1 기록 보상이 도착했어요',
      sub: '시즌 1 명예의 전당 기록으로 리롤권 12장, 잠재력 강화권 4장과 프리미엄 스카우트권 1장을 받을 수 있어요.',
      detail: '명예의 전당 13위 · 아이콘 2명 · 발롱도르 수상 선수 2명',
      done: '리롤권 12장, 잠재력 강화권 4장과 프리미엄 스카우트권 1장을 받았어요.',
    });
    // 아이콘이 없으면 레전드 수, 받지 않는 갈래(1000위 밖)는 뺀다.
    const legendOnly = {
      ...record,
      reroll: 0,
      scout: 0,
      boost: 1,
      record: {
        ...record.record,
        hofRank: null,
        icons: 0,
        ballonPlayers: 0,
        hof: z,
        ballon: z,
        legend: { ...z, boost: 1 },
      },
    };
    expect(giftCopy(legendOnly).detail).toBe('레전드 3명');
    setLocale('en', en);
    expect(giftCopy(record).detail).toBe("Hall of Fame #13 · 2 Icons · 2 Ballon d'Or winners");
    setLocale('ja', ja);
    expect(giftCopy(record).title).toBe('シーズン1の記録報酬が届きました');
  });
});
