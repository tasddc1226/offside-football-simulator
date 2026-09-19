import { describe, expect, it } from 'vitest';
import {
  matchResultBucket,
  matchResultHeadline,
  seasonResultBucket,
  seasonResultHeadline,
  type SeasonResultHeadlineInput,
} from './result-narrative.js';

const SEASON_INPUT: SeasonResultHeadlineInput = {
  seed: 'career-1',
  seasonIndex: 1,
  promoted: false,
  relegated: false,
  avgRatingTenths: null,
  leaguePosition: null,
  leagueTeamCount: null,
  appearanceRatePercent: null,
  minutesPlayed: null,
};

describe('matchResultBucket', () => {
  it('평점·득점·도움·챕터 성공 중 하나만 있어도 WIN을 돋보이는 버킷으로 분류한다', () => {
    expect(
      matchResultBucket({ seed: 's', outcome: 'WIN', ratingTenths: 60, scored: true, assisted: false, chapterOutcome: null }),
    ).toBe('WIN_STANDOUT');
    expect(
      matchResultBucket({ seed: 's', outcome: 'WIN', ratingTenths: 60, scored: false, assisted: false, chapterOutcome: null }),
    ).toBe('WIN_SOLID');
  });

  it('패배는 평점이 낮거나 챕터가 실패면 힘든 버킷으로 분류한다(득점·도움만으로는 구제하지 않는다)', () => {
    expect(
      matchResultBucket({ seed: 's', outcome: 'LOSS', ratingTenths: 50, scored: true, assisted: false, chapterOutcome: null }),
    ).toBe('LOSS_HARD');
    expect(
      matchResultBucket({ seed: 's', outcome: 'LOSS', ratingTenths: 68, scored: true, assisted: false, chapterOutcome: null }),
    ).toBe('LOSS_BRIGHT');
  });
});

describe('matchResultHeadline (결정론)', () => {
  it('같은 입력이면 항상 같은 문구를 돌려준다(Math.random 없음)', () => {
    const input = {
      seed: 'career-1:match-7',
      outcome: 'WIN' as const,
      ratingTenths: 82,
      scored: true,
      assisted: false,
      chapterOutcome: 'SUCCESS' as const,
    };
    expect(matchResultHeadline(input)).toBe(matchResultHeadline(input));
  });

  it('시드가 다르면 같은 버킷 안에서 다른 문구가 나올 수 있다(뱅크에 변형이 2개 이상)', () => {
    const base = { outcome: 'WIN' as const, ratingTenths: 82, scored: true, assisted: false, chapterOutcome: null };
    const variants = new Set(
      Array.from({ length: 20 }, (_, i) => matchResultHeadline({ ...base, seed: `career-${i}:match-1` })),
    );
    expect(variants.size).toBeGreaterThan(1);
  });
});

describe('seasonResultBucket', () => {
  it('승격권이 강등·평점보다 우선한다', () => {
    expect(seasonResultBucket({ ...SEASON_INPUT, promoted: true, avgRatingTenths: 40 })).toBe('PROMOTION');
  });

  it('승격권도 강등도 아니면 평균 평점으로 갈린다', () => {
    expect(seasonResultBucket({ ...SEASON_INPUT, avgRatingTenths: 80 })).toBe('TOP_FORM');
    expect(seasonResultBucket({ ...SEASON_INPUT, avgRatingTenths: 40 })).toBe('STRUGGLE');
    expect(seasonResultBucket({ ...SEASON_INPUT, avgRatingTenths: 65 })).toBe('STEADY');
  });
});

describe('seasonResultHeadline (결정론)', () => {
  it('같은 입력이면 항상 같은 문구를 돌려준다', () => {
    const input = { ...SEASON_INPUT, relegated: true, avgRatingTenths: 58 };
    expect(seasonResultHeadline(input)).toBe(seasonResultHeadline(input));
  });

  it('직전 저장 시즌에서 재구성한 문구는 다음 시즌 후보에서 제외한다', () => {
    const previousHeadline = seasonResultHeadline({ ...SEASON_INPUT, seasonIndex: 4, avgRatingTenths: 65 });
    const currentHeadline = seasonResultHeadline({
      ...SEASON_INPUT,
      seasonIndex: 5,
      avgRatingTenths: 65,
      previousHeadline,
    });
    expect(currentHeadline).not.toBe(previousHeadline);
  });

  it('순위·출전 비율·평점은 전달된 저장값만 문구에 반영한다', () => {
    const contextual = Array.from({ length: 30 }, (_, offset) => seasonResultHeadline({
      ...SEASON_INPUT,
      seasonIndex: offset + 1,
      promoted: true,
      avgRatingTenths: 78,
      leaguePosition: 2,
      leagueTeamCount: 12,
      appearanceRatePercent: 63,
      minutesPlayed: 1_500,
    }));
    const topForm = Array.from({ length: 30 }, (_, offset) => seasonResultHeadline({
      ...SEASON_INPUT,
      seasonIndex: offset + 1,
      avgRatingTenths: 78,
      appearanceRatePercent: 63,
      minutesPlayed: 1_500,
    }));
    const unavailable = Array.from({ length: 30 }, (_, offset) =>
      seasonResultHeadline({ ...SEASON_INPUT, seasonIndex: offset + 1, avgRatingTenths: 65 }),
    );

    expect(contextual.some((headline) => headline.includes('2위/12팀'))).toBe(true);
    expect(contextual.some((headline) => headline.includes('63%'))).toBe(true);
    expect(topForm.some((headline) => headline.includes('7.8'))).toBe(true);
    expect(unavailable.every((headline) => !/\d+위\/\d+팀|출전 비율/.test(headline))).toBe(true);
  });

  it('0분 시즌과 출전 비율 미기록 시즌을 꾸준한 활약으로 포장하지 않는다', () => {
    const noMinutes = Array.from({ length: 30 }, (_, offset) =>
      seasonResultHeadline({ ...SEASON_INPUT, seasonIndex: offset + 1, appearanceRatePercent: 0, minutesPlayed: 0 }),
    );
    const unavailable = Array.from({ length: 30 }, (_, offset) =>
      seasonResultHeadline({ ...SEASON_INPUT, seasonIndex: offset + 1 }),
    );

    expect(noMinutes.every((headline) => !/꾸준|경험을 쌓|자리를 지키/.test(headline))).toBe(true);
    expect(noMinutes.some((headline) => headline.includes('0%'))).toBe(true);
    expect(unavailable.every((headline) => !/0%|나서지 못|출전 없이|출전 기록 없이/.test(headline))).toBe(true);
  });

  it('이슈 144: 승강이 없는 규칙에서 승격·강등이 실제 발생했다고 단정하지 않는다', () => {
    const promotionZone = Array.from({ length: 30 }, (_, offset) => seasonResultHeadline({
      ...SEASON_INPUT,
      seasonIndex: offset + 1,
      promoted: true,
      leaguePosition: 2,
      leagueTeamCount: 12,
    }));
    const relegationZone = Array.from({ length: 30 }, (_, offset) => seasonResultHeadline({
      ...SEASON_INPUT,
      seasonIndex: offset + 1,
      relegated: true,
      leaguePosition: 11,
      leagueTeamCount: 12,
    }));

    expect(promotionZone.every((headline) => !/승격을|승격과|더 높은 리그/.test(headline))).toBe(true);
    expect(relegationZone.every((headline) => !/강등을|강등과/.test(headline))).toBe(true);
  });
});
