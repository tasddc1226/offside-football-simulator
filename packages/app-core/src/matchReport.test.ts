import { describe, expect, it } from 'vitest';
import type { TeamMatch } from './api/team.js';
import { FORMATIONS, YOUTH_OVR, presetLayout } from '@offside/contracts/owner-team';
import { decisiveLine, weakestLine } from '@offside/contracts/owner-team';
import type { MatchGame } from '@offside/game/engine';
import { fixSlot, matchOddsView, seasonReportView, teamMatchReport } from './matchReport.js';
import { momentGoalSummary, pickedChoice, pickedPct } from './teamMoments.js';
import type { TeamMoment } from './api/team.js';
import { growthDirectionNote, ratingBreakdown } from './ratingReport.js';

type Lines = { atk: number; mid: number; def: number; gk: number };
const side = (goals: number, xg?: number, lines?: Lines) => ({
  teamId: 't',
  name: '팀',
  owner: '감독',
  formation: '4-3-3' as const,
  ovr: 80,
  goals,
  ratingChange: null,
  ...(xg === undefined ? {} : { xg, lines }),
});
const match = (
  home: ReturnType<typeof side>,
  away: ReturnType<typeof side>,
  mine: 'home' | 'away' = 'home',
): TeamMatch => ({
  id: 'm',
  home,
  away,
  events: [],
  mine,
  createdAt: '2026-10-18T00:00:00.000Z',
});
const even: Lines = { atk: 75, mid: 75, def: 75, gk: 75 };

describe('T-11-379 줄 비교 무게', () => {
  it('결정적 비교는 무게 × 차이로, 약한 줄은 밀린 줄 중에서 고른다', () => {
    // 중원 8점(무게 0.2 → 1.6)보다 공격 6점(0.3 → 1.8)이 크다.
    expect(decisiveLine({ atk: 6, mid: -8, def: 0 })).toBe('atk');
    expect(weakestLine({ atk: 6, mid: -8, def: -2 })).toBe('mid');
    expect(weakestLine({ atk: 1, mid: 2, def: 3 })).toBeNull();
  });
});

describe('T-11-379 한 판 리포트', () => {
  it('기대 득점이 없는 옛 경기는 리포트가 없다', () => {
    expect(teamMatchReport(match(side(1), side(0)))).toBeNull();
  });

  it('내 쪽(받은 경기면 away)에서 줄을 비교하고 결정적 비교로 한 줄을 고른다', () => {
    const strongAtk = { ...even, atk: 85 };
    const r = teamMatchReport(match(side(0, 0.9, even), side(2, 1.9, strongAtk), 'away'))!;
    expect(r.xgText).toBe('기대 득점(xG) 1.9 : 0.9');
    expect(r.rows.map((x) => [x.line, x.mine, x.opp])).toEqual([
      ['atk', 85, 75],
      ['mid', 75, 75],
      ['def', 75, 75],
    ]);
    expect(r.diagnosis).toBe('공격이 상대 수비벽보다 10 앞서 기회를 많이 만들었어요.');
    expect(r.weak).toBeNull();
  });

  it('기대 득점은 앞섰는데 졌으면 운 이야기를, 비슷하면 그날 흐름을 말한다', () => {
    const weakDef = { ...even, def: 65 };
    expect(teamMatchReport(match(side(0, 2.1, even), side(1, 0.8, weakDef)))!.diagnosis).toBe(
      '기대 득점은 앞섰지만 골이 따라오지 않았어요.',
    );
    const r = teamMatchReport(match(side(1, 1.3, even), side(1, 1.2, even)))!;
    expect(r.diagnosis).toBe('세 줄이 모두 비슷했어요. 결과는 그날 흐름이 갈랐어요.');
    const lost = teamMatchReport(match(side(0, 1, weakDef), side(1, 1.4, even)))!;
    expect(lost.weak).toBe('def');
    expect(lost.diagnosis).toBe('수비벽이 상대 공격보다 7 약해 기회를 많이 내줬어요.');
  });
});

describe('T-11-379 고칠 곳', () => {
  const slots = presetLayout('4-3-3').map((p) => p.slot);
  it('약한 줄에서 몫 × 남은 여지가 가장 큰 자리를 고른다', () => {
    const ratings = slots.map(() => 80);
    const st = slots.indexOf('ST');
    ratings[st] = 60;
    expect(fixSlot(slots, ratings, 'atk', YOUTH_OVR)).toBe(st);
    const cb = slots.indexOf('CB');
    const r2: (number | null)[] = slots.map(() => 85);
    r2[cb] = null; // 빈 자리 = 유스
    expect(fixSlot(slots, r2, 'def', YOUTH_OVR)).toBe(cb);
    expect(FORMATIONS['4-3-3']).toHaveLength(11);
  });
});

describe('T-11-379 시즌 리포트', () => {
  it('기대 득점이 모인 경기가 없으면 null, 있으면 마무리 · 밀린 줄 · 포메이션별 줄', () => {
    expect(seasonReportView(undefined)).toBeNull();
    const v = seasonReportView({
      matches: 5,
      xgFor: 6.4,
      xgAgainst: 5.1,
      gf: 9,
      ga: 4,
      edges: { atk: 2.1, mid: -3.4, def: 0.5 },
      behind: { atk: 1, mid: 4, def: 2 },
      formations: [
        { formation: '4-3-3', w: 3, d: 1, l: 1, gf: 9, ga: 4, xgFor: 6.4, xgAgainst: 5.1 },
      ],
    })!;
    expect(v.xg).toBe('5경기 · 기대 득점 6.4 → 실제 9골 · 기대 실점 5.1 → 실제 4골');
    expect(v.finish).toBe('기대보다 2.6골 더 넣었어요.');
    expect(v.behind).toBe('가장 자주 밀린 비교는 내 중원 vs 상대 중원이에요(4/5경기).');
    expect(v.formations[0]!.text).toBe('3승 1무 1패 · 기대 득점 6.4 : 5.1');
  });
});

describe('T-11-379 평점 구성', () => {
  const parts = (o: Partial<NonNullable<MatchGame['parts']>>) => ({
    goals: 0,
    assists: 0,
    ovrEdge: 0,
    cond: 0,
    morale: 0,
    form: 0,
    cs: 0,
    def: 0,
    result: 0,
    luck: 0,
    ...o,
  });
  it('뛴 경기 평균을 보이고, 기본 + 줄 합이 평균 평점과 맞는다', () => {
    const games: MatchGame[] = [
      {
        rd: 1,
        res: 'W',
        mins: 90,
        g: 1,
        a: 0,
        rating: 7.6,
        parts: parts({ goals: 0.9, ovrEdge: 0.3, result: 0.2, luck: 0.02 }),
      },
      {
        rd: 2,
        res: 'L',
        mins: 90,
        g: 0,
        a: 0,
        rating: 5.9,
        parts: parts({ ovrEdge: 0.3, form: -0.4, result: -0.2, luck: 0.03 }),
      },
      { rd: 3, res: 'D', mins: 0 },
    ];
    const b = ratingBreakdown(games, 6.2)!;
    expect(b.avg).toBe(6.75);
    const sum = b.base + b.rows.reduce((t, r) => t + r.value, 0);
    expect(Math.abs(sum - b.avg)).toBeLessThan(0.051);
    expect(b.rows.find((r) => r.key === 'goals')!.value).toBe(0.5);
    expect(b.rows.some((r) => r.key === 'cs')).toBe(false);
    expect(ratingBreakdown([{ rd: 1, res: 'W', mins: 0 }], 6.2)).toBeNull();
  });
});

describe('T-11-379 성장 방향', () => {
  it('포지션에 맞는 한 줄을 만든다', async () => {
    await import('@offside/game/index');
    const { newGame } = await import('@offside/game/engine');
    const { createRng, setActiveRng } = await import('@offside/game/rng');
    const { TYPES } = await import('@offside/game/data');
    setActiveRng(createRng(3));
    const fw = newGame(
      { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: TYPES.FW[0]!.id, trait: 'late' },
      3,
    );
    expect(growthDirectionNote(fw)).toMatch(
      /^골에는 .+ 비중이 60%로 가장 커요\. 지금 리그 평균보다 \d+ (높아요|낮아요)\.$/,
    );
    const gk = newGame(
      { name: 'b', number: 1, pos: 'GK', foot: '오른발', type: TYPES.GK[0]!.id, trait: 'late' },
      3,
    );
    expect(growthDirectionNote(gk)).toMatch(/^평점에는 수비 능력치가/);
  });
});

describe('T-11-760 결과 화면의 경기 전 예상', () => {
  it('기대 득점이 없는 옛 경기는 예상이 없다', () => {
    expect(matchOddsView(match(side(1), side(0)))).toBeNull();
  });

  it('내 쪽 기대 득점으로 승 · 무 · 패를 다시 계산하고 합은 100이다', () => {
    const o = matchOddsView(match(side(1, 2.2, even), side(1, 1.5, even)))!;
    expect(o.win + o.draw + o.loss).toBe(100);
    expect(o.win).toBeGreaterThan(o.loss);
    // 받은 경기(away)는 뒤집어 본다.
    const flip = matchOddsView(match(side(1, 2.2, even), side(1, 1.5, even), 'away'))!;
    expect(flip.win).toBe(o.loss);
    expect(flip.rare).toBeNull();
  });

  it('예상이 25% 이하였던 승리 · 패배만 드물었다고 알려 준다', () => {
    // 흐에 사례: 기대 득점 4.5 : 1.9, 2 : 3 패배.
    const loss = matchOddsView(match(side(2, 4.5, even), side(3, 1.9, even)))!;
    expect(loss.win).toBeGreaterThanOrEqual(75);
    expect(loss.rare).toBe(
      `질 확률이 ${loss.loss}%였던 경기예요. 이런 결과는 ${Math.round(100 / loss.loss)}경기에 1번쯤 나와요.`,
    );
    const upset = matchOddsView(match(side(1, 1.9, even), side(0, 4.5, even)))!;
    expect(upset.rare).toBe(`이길 확률이 ${upset.win}%였던 경기를 잡았어요.`);
    expect(matchOddsView(match(side(2, 4.5, even), side(2, 1.9, even)))!.rare).toBeNull();
    expect(matchOddsView(match(side(0, 2.2, even), side(1, 1.5, even)))!.rare).toBeNull();
  });
});

describe('T-11-760 장면 기록 확률 · 골 출처', () => {
  const moment = (picked: string, extra: Partial<TeamMoment> = {}): TeamMoment => ({
    index: 0,
    minute: 61,
    kind: 'chance',
    situation: 'late-run',
    actor: { name: 'A', id: null, slot: 'CM' },
    mate: { name: 'B', id: null, slot: 'RW' },
    opp: { name: 'C', id: null, slot: 'ST' },
    choices: [
      { id: 'arrive', pct: 52, mate: false, risk: 20, gain: 0 },
      { id: 'edge', pct: 62, mate: false, risk: 0, gain: 0 },
    ],
    picked,
    ok: true,
    ...extra,
  });
  const name = (_: string | null, f: string) => f;

  it('고른 선택지는 그 확률을, 맡긴 장면은 남은 판정 확률을 붙인다', () => {
    expect(pickedPct(moment('edge'))).toBe(62);
    expect(pickedChoice(moment('edge'), name)).toMatch(/ 62%$/);
    expect(pickedPct(moment('auto', { autoPct: 41 }))).toBe(41);
    // 옛 기록의 맡긴 장면은 확률이 없어 이름만 쓴다.
    expect(pickedPct(moment('auto'))).toBeNull();
    expect(pickedChoice(moment('auto'), name)).toBe('감독에게 맡김');
  });

  it('골 출처가 남은 경기만 장면 골 수를 말한다', () => {
    const ev = (moment?: boolean) => ({
      minute: 10,
      side: 'home' as const,
      scorer: 'A',
      assist: null,
      scorerId: null,
      assistId: null,
      ...(moment === undefined ? {} : { moment }),
    });
    expect(momentGoalSummary({ events: [ev(), ev()] })).toBeNull();
    expect(momentGoalSummary({ events: [] })).toBeNull();
    expect(momentGoalSummary({ events: [ev(true), ev(false), ev(false)] })).toBe(
      '골 3개 중 1개가 결정적 장면에서 나왔어요.',
    );
    expect(momentGoalSummary({ events: [ev(false)] })).toBe(
      '이 경기 골은 모두 결정적 장면 밖에서 나왔어요.',
    );
  });
});
