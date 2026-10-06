import type { OwnerHonor } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { honorViews, rankText, recapCardView, recapCutoffText } from './seasonRecap.js';

const honor = (o: Partial<OwnerHonor> & Pick<OwnerHonor, 'kind'>): OwnerHonor => ({
  season: 0,
  band: null,
  rank: null,
  value: null,
  grantedAt: '2026-10-07T00:00:00.000Z',
  ...o,
});

describe('T-11-128 시즌 결산 문구', () => {
  it('휘장은 최신 시즌 · 금은동 · 종류 순, 단계로 메달 색을 정한다', () => {
    const views = honorViews([
      honor({ kind: 'pioneer', value: 3 }),
      honor({ kind: 'hof', band: 100, rank: 42 }),
      honor({ kind: 'achievements', band: 1, rank: 1 }),
      honor({ kind: 'team', band: 10, rank: 4, season: 1 }),
      honor({ kind: 'wall-of-honor', value: 2 }),
    ]);
    expect(views.map((v) => [v.season, v.kind, v.detail, v.medal])).toEqual([
      [1, 'team', '4위로 마감', 'silver'],
      [0, 'achievements', '1위로 마감', 'gold'],
      [0, 'hof', '42위로 마감', 'bronze'],
      [0, 'wall-of-honor', '2명', 'bronze'],
      [0, 'pioneer', '은퇴 선수 3명', 'bronze'],
    ]);
    expect(views.at(-1)?.title).toBe('프리시즌 개척자');
  });

  it('순위가 없으면 순위 밖, 기준 날짜는 마감 전날(한국 시각)', () => {
    expect(rankText(null, 10)).toBe('순위 밖');
    expect(rankText(3, 1818)).toBe('3위 / 1,818');
    expect(recapCutoffText({ cutoff: '2026-10-05T15:00:00.000Z' })).toBe(
      '2026년 10월 5일까지의 기록이에요',
    );
  });

  it('결산 카드: 상태 한 줄과 휘장 수, 알약은 3개까지', () => {
    const honors = ['pioneer', 'hof', 'team', 'first'].map((kind) =>
      honor({ kind: kind as OwnerHonor['kind'], value: 1 }),
    );
    const ready = recapCardView({ season: 0, status: 'ready', recap: null, honors });
    expect(ready.line).toBe('프리시즌 결산이 나왔어요 · 기록 배지 4개를 받았어요');
    expect(ready.chips).toHaveLength(3);
    const pending = recapCardView({ season: 0, status: 'pending', recap: null, honors: [] });
    expect(pending.isNew).toBe(false);
    expect(pending.line).not.toContain('·');
  });
});
