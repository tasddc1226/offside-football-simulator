import { describe, expect, it } from 'vitest';
import { BODY_DEFAULT, bmiOf, bodyError } from './body.js';
import { CareerMetaSchema } from './careers.js';
import { honorPoints } from './retired-numbers.js';
import { DEFAULT_NATION, NATIONS, NATION_BY_CODE, flagOf, nationFromLocales } from './nations.js';

describe('T-10-096 국적', () => {
  it('FIFA 회원국 211개, 코드·이름이 겹치지 않고 대한민국이 기본이다', () => {
    expect(NATIONS).toHaveLength(211);
    expect(new Set(NATIONS.map((n) => n.code)).size).toBe(211);
    expect(new Set(NATIONS.map((n) => n.ko)).size).toBe(211);
    expect(NATION_BY_CODE.get(DEFAULT_NATION)).toMatchObject({
      ko: '대한민국',
      conf: 'AFC',
      str: 75,
    });
    expect(flagOf('KR')).toBe('🇰🇷');
  });
});

describe('T-10-096 체격', () => {
  it('키 160~200cm · 몸무게 55~100kg · BMI 18.5~30 밖은 막는다', () => {
    expect(bodyError({ h: 180, w: 74 })).toBeNull();
    expect(bodyError({ h: 159, w: 60 })).toMatch('키');
    expect(bodyError({ h: 201, w: 90 })).toMatch('키');
    expect(bodyError({ h: 180, w: 54 })).toMatch('몸무게');
    expect(bodyError({ h: 180, w: 101 })).toMatch('몸무게');
    expect(bodyError({ h: 180.5, w: 74 })).toMatch('키');
    expect(bodyError({ h: 195, w: 60 })).toMatch('가벼워요'); // BMI 15.8
    expect(bodyError({ h: 165, w: 90 })).toMatch('무거워요'); // BMI 33.1
  });
  it('포지션 기본 체격은 모두 허용 범위 안이다', () => {
    for (const b of Object.values(BODY_DEFAULT)) {
      expect(bodyError(b)).toBeNull();
      expect(bmiOf(b)).toBeGreaterThan(22);
    }
  });
});

describe('T-10-096 커리어 메타', () => {
  const base = {
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    startYear: 2026,
    appVersion: '1',
  } as const;
  it('국적·체격 없이 보내는 옛 클라이언트도 통과한다', () => {
    expect(CareerMetaSchema.safeParse(base).success).toBe(true);
  });
  it('알려진 국적 코드와 범위 안의 체격만 받는다', () => {
    expect(
      CareerMetaSchema.safeParse({ ...base, nation: 'BR', height: 181, weight: 76 }).success,
    ).toBe(true);
    expect(CareerMetaSchema.safeParse({ ...base, nation: 'XX' }).success).toBe(false);
    expect(CareerMetaSchema.safeParse({ ...base, height: 181 }).success).toBe(false);
    expect(CareerMetaSchema.safeParse({ ...base, height: 230, weight: 90 }).success).toBe(false);
    expect(CareerMetaSchema.safeParse({ ...base, height: 190, weight: 58 }).success).toBe(false);
  });
});

describe('T-10-096 대표팀 수상은 구단 영구결번 점수에 들지 않는다', () => {
  it.each([
    'UEFA 유로 우승',
    '코파 아메리카 우승',
    '아프리카 네이션스컵 우승',
    'CONCACAF 골드컵 우승',
    'OFC 네이션스컵 우승',
    '브라질 축구협회 올해의 선수',
    'UEFA 올해의 선수',
    '남미 올해의 선수',
    '아프리카 올해의 선수',
    'CONCACAF 올해의 선수',
    'OFC 올해의 선수',
  ])('%s', (h) => expect(honorPoints(h)).toBe(0));
});

describe('선수 생성 국적 기본값(T-11-140)', () => {
  it.each([
    [['ja-JP'], 'JP'],
    [['ja'], 'JP'],
    [['en-US', 'ko-KR'], 'US'],
    [['en-GB'], 'GB-ENG'],
    [['ko'], 'KR'],
    [['en'], 'KR'],
    [['zh-Hant-TW'], 'TW'],
    [['en-AQ'], 'KR'],
    [[], 'KR'],
  ])('%j → %s', (tags, code) => expect(nationFromLocales(tags)).toBe(code));
});
