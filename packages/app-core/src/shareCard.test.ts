import { describe, expect, it } from 'vitest';
import type { PlayStyle } from '@offside/contracts';
import { STYLE_COUNTERS } from '@offside/contracts/play-style';
import type { CareerRecord, LegendSource } from '@offside/game/types';
import type { LegendView } from './state.js';
import { shareCardData } from './shareCard.js';

const season = (
  year: number,
  club: string,
  league: string,
  o: Partial<CareerRecord> = {},
): CareerRecord => ({
  year,
  age: year - 2008,
  club,
  league,
  apps: 30,
  goals: 10,
  assists: 5,
  cs: 3,
  rating: 7,
  rank: 1,
  ovr: 70,
  honors: [],
  ...o,
});
const style: PlayStyle = {
  from: 18,
  betOdds: 800,
  ...(Object.fromEntries(STYLE_COUNTERS.map((k) => [k, 0])) as Record<
    (typeof STYLE_COUNTERS)[number],
    number
  >),
  bets: 16,
  betWins: 12,
  safe: 10,
  sure: 8,
};
function view(career: CareerRecord[], o: Partial<LegendView> = {}, withStyle = false): LegendView {
  const d = {
    pos: 'FW',
    peak: 88,
    career,
    trophies: [],
    awards: [],
    ballon: [],
    storyLog: [],
    miles: [],
    titles: [],
    nat: { caps: 0 },
    ...(withStyle ? { style } : {}),
  } as LegendSource;
  return {
    name: '도하람',
    number: 17,
    pos: 'FW',
    dpos: null,
    age: 34,
    lastClub: career.at(-1)!.club,
    score: 612,
    peak: 88,
    d,
    totals: { apps: 0, goals: 0, assists: 0, trophies: 4, awards: 2, caps: 30, ballon: 0 },
    own: null,
    shareId: null,
    reportId: null,
    title: null,
    ...o,
  };
}

describe('T-10-079 공유 이미지 카드 내용', () => {
  it('머리·점수·통산 기록을 은퇴 리포트와 같은 값으로 만든다', () => {
    const c = shareCardData(
      view([season(2026, '청운고', '고교 리그'), season(2027, 'A', 'K리그1')]),
      null,
    );
    expect(c.kicker).toBe('FULL TIME · NO.17');
    expect(c.sub).toBe('공격수 · 2026–2027 · 34세 은퇴');
    expect(c.pills[0]).toEqual({ text: '월드클래스 레전드', gold: true });
    expect(c.stats.map((s) => `${s.label}:${s.value}`)).toEqual([
      '시즌:2',
      '경기:60',
      '골:20',
      '도움:10',
      '트로피:4',
    ]);
    expect(c.style).toBeNull();
  });

  it('명예의 벽 대표 칭호는 점수 등급과 함께 표시하며 영구결번 유니폼을 만들지 않는다', () => {
    const c = shareCardData(view([season(2027, 'A', 'K리그1')]), 'wall_of_honor');
    expect(c.pills.map((p) => p.text)).toContain('‘명예의 벽’');
    expect(c.jersey).toBeNull();
  });

  it('영구결번이 있으면 최고 OVR 대신 결번 배지', () => {
    const v = view([season(2027, 'A', 'K리그1')], {
      rn: { kind: 'granted', clubId: 'k1-1', club: 'A', number: 17, seq: 1 },
    });
    const c = shareCardData(v, null);
    expect(c.pills.map((p) => p.text + (p.tail ?? ''))).toEqual([
      '월드클래스 레전드',
      '👑 A 영구결번 17',
    ]);
    // 점수 옆 결번 액자 — 그 구단 유니폼.
    expect(c.jersey).toEqual({ number: 17, clubId: 'k1-1' });
  });

  it('결번이 없으면 액자 없이, 모르는 구단의 결번도 구단 id째 넘긴다(기본 색은 rnFrame이 정한다)', () => {
    const one = shareCardData(view([season(2027, 'A', 'K리그1')]), null);
    expect(one.jersey).toBeNull();
    // 한 시즌이면 기간도 한 해만.
    expect(one.sub).toBe('공격수 · 2027 · 34세 은퇴');
    const v = view([season(2027, 'A', 'K리그1')], {
      rn: { kind: 'granted', clubId: 'zz-9', club: 'A', number: 3, seq: 2 },
    });
    expect(shareCardData(v, null).jersey).toEqual({ number: 3, clubId: 'zz-9' });
  });

  it('구단이 많으면 첫 구단과 마지막 구단만 남기고, 성향이 있으면 성향 칸을 채운다', () => {
    const clubs = ['청운고', 'A', 'B', 'C', 'D', 'E'];
    const career = clubs.map((c, i) => season(2026 + i, c, i ? 'K리그1' : '고교 리그'));
    const plain = shareCardData(view(career), null);
    expect(plain.stops.map((s) => s?.club ?? '…')).toEqual(['청운고', '…', 'C', 'D', 'E']);
    const styled = shareCardData(view(career, {}, true), null);
    expect(styled.stops.map((s) => s?.club ?? '…')).toEqual(['청운고', '…', 'E']);
    expect(styled.style?.name).toBe('타고난 강운');
  });

  it('성향이 없으면 여정 아래에 대표 우승(발롱도르 먼저, 많이 든 순)을 싣고 여정을 3곳으로 줄인다', () => {
    const clubs = ['청운고', 'A', 'B', 'C', 'D', 'E'];
    const career = clubs.map((c, i) => season(2026 + i, c, i ? 'K리그1' : '고교 리그'));
    const d = view(career).d!;
    const v = view(career, {
      d: {
        ...d,
        trophies: [
          { year: 2030, t: 'FA컵 우승', club: 'E' },
          { year: 2030, t: '프리미어리그 우승', club: 'E' },
          { year: 2031, t: '프리미어리그 우승', club: 'E' },
        ],
        awards: [
          { year: 2030, t: '프리미어리그 득점왕' },
          { year: 2031, t: '발롱도르' },
        ],
      },
    });
    const c = shareCardData(v, null);
    expect(c.honours).toEqual([
      { count: '×1', name: '발롱도르' },
      { count: '×2', name: '프리미어리그 우승' },
      { count: '×1', name: 'FA컵 우승' },
    ]);
    expect(c.stops.map((s) => s?.club ?? '…')).toEqual(['청운고', '…', 'E']);
    // 성향 칸이 있으면 우승 칸은 없다.
    expect(shareCardData(view(career, { d: { ...v.d!, style } }), null).honours).toEqual([]);
  });
});
