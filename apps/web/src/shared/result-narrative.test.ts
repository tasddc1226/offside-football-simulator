import { describe, expect, it } from 'vitest';
import {
  matchResultBucket,
  matchResultHeadline,
  seasonResultBucket,
  seasonResultHeadline,
} from './result-narrative.js';

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
    expect(seasonResultBucket({ seed: 's', promoted: true, relegated: false, avgRatingTenths: 40 })).toBe('PROMOTION');
  });

  it('승격권도 강등도 아니면 평균 평점으로 갈린다', () => {
    expect(seasonResultBucket({ seed: 's', promoted: false, relegated: false, avgRatingTenths: 80 })).toBe('TOP_FORM');
    expect(seasonResultBucket({ seed: 's', promoted: false, relegated: false, avgRatingTenths: 40 })).toBe('STRUGGLE');
    expect(seasonResultBucket({ seed: 's', promoted: false, relegated: false, avgRatingTenths: 65 })).toBe('STEADY');
  });
});

describe('seasonResultHeadline (결정론)', () => {
  it('같은 입력이면 항상 같은 문구를 돌려준다', () => {
    const input = { seed: 'career-1:0', promoted: false, relegated: true, avgRatingTenths: 58 };
    expect(seasonResultHeadline(input)).toBe(seasonResultHeadline(input));
  });
});
