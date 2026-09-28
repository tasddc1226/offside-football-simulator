import { describe, expect, it } from 'vitest';
import type { PlayStyle } from '@offside/contracts';
import { STYLE_COUNTERS } from '@offside/contracts/play-style';
import type { CareerRecord, LegendSource } from '../../game/types.js';
import type { LegendView } from '../state.svelte.js';
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
    age: 34,
    lastClub: career.at(-1)!.club,
    score: 612,
    peak: 88,
    d,
    totals: { apps: 0, goals: 0, assists: 0, trophies: 4, awards: 2, caps: 30 },
    own: null,
    shareId: null,
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

  it('영구결번이 있으면 최고 OVR 대신 결번 배지', () => {
    const v = view([season(2027, 'A', 'K리그1')], {
      rn: { kind: 'granted', clubId: 'k1-1', club: 'A', number: 17, seq: 1 },
    });
    expect(shareCardData(v, null).pills.map((p) => p.text)).toEqual([
      '월드클래스 레전드',
      '👑 A 영구결번 17',
    ]);
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
});
