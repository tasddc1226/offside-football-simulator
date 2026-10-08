import { describe, expect, it } from 'vitest';
import type { CupMatch, CupResponse } from '@offside/app-core/api/cup';
import {
  bracketRounds,
  closeShownAt,
  groupMatches,
  kstParts,
  lockWhen,
  phaseLine,
  roundLabel,
  stageLabel,
  winnerSide,
} from './cupView.js';

const match = (p: Partial<CupMatch>): CupMatch => ({
  id: 'm',
  round: 'r32',
  group: null,
  slot: 0,
  homeTeamId: 'a',
  awayTeamId: 'b',
  at: '2026-10-16T12:00:00.000Z',
  played: false,
  homeGoals: null,
  awayGoals: null,
  pens: null,
  winnerTeamId: null,
  forfeit: false,
  ...p,
});

describe('컵 화면 도우미', () => {
  it('한국 시간 기준으로 날짜·시각을 나눈다', () => {
    // 2026-10-13T12:00Z = KST 21:00
    expect(kstParts('2026-10-13T12:00:00.000Z')).toMatchObject({
      month: 10,
      day: 13,
      time: '21:00',
    });
    // UTC 날짜가 하루 앞서도 KST로는 다음 날
    expect(kstParts('2026-10-12T15:30:00.000Z')).toMatchObject({
      month: 10,
      day: 13,
      time: '00:30',
    });
  });

  it('접수 마감은 1분 앞당겨 23:59로 보인다', () => {
    const closes = '2026-10-12T15:00:00.000Z'; // KST 10/13 00:00
    expect(kstParts(closeShownAt(closes))).toMatchObject({ month: 10, day: 12, time: '23:59' });
  });

  it('명단 마감이 오늘이면 오늘, 아니면 날짜를 쓴다', () => {
    const lock = '2026-10-14T11:00:00.000Z'; // KST 10/14 20:00
    expect(lockWhen(lock, Date.parse('2026-10-14T01:00:00.000Z'))).toBe('오늘 20:00');
    expect(lockWhen(lock, Date.parse('2026-10-13T03:00:00.000Z'))).toBe('10월 14일 20:00');
  });

  it('라운드·성적 이름', () => {
    expect(roundLabel('f')).toBe('결승');
    expect(roundLabel('g2')).toBe('조별 2경기');
    expect(stageLabel('runnerup')).toBe('준우승');
  });

  it('토너먼트는 라운드 순서·대진 순서로 묶고 빈 라운드는 뺀다', () => {
    const rounds = bracketRounds([
      match({ id: 'q2', round: 'qf', slot: 1 }),
      match({ id: 'r', round: 'r16', slot: 0 }),
      match({ id: 'q1', round: 'qf', slot: 0 }),
      match({ id: 'g', round: 'g1', group: 1 }),
    ]);
    expect(rounds.map((r) => r.round)).toEqual(['r16', 'qf']);
    expect(rounds[1]!.matches.map((m) => m.id)).toEqual(['q1', 'q2']);
  });

  it('조별 경기는 그 조만 라운드 순으로', () => {
    const list = groupMatches(
      [
        match({ id: 'b', round: 'g2', group: 1 }),
        match({ id: 'a', round: 'g1', group: 1 }),
        match({ id: 'x', round: 'g1', group: 2 }),
        match({ id: 'k', round: 'r32', group: null }),
      ],
      1,
    );
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('승부차기까지 반영해 이긴 쪽을 가린다', () => {
    expect(winnerSide(match({}))).toBeNull();
    expect(winnerSide(match({ played: true, homeGoals: 2, awayGoals: 1 }))).toBe('home');
    expect(
      winnerSide(
        match({
          played: true,
          homeGoals: 1,
          awayGoals: 1,
          winnerTeamId: 'b',
          pens: { home: 3, away: 4 },
        }),
      ),
    ).toBe('away');
    expect(winnerSide(match({ played: true, homeGoals: 1, awayGoals: 1 }))).toBeNull();
  });

  it('단계별 한 줄 안내', () => {
    const base: CupResponse = {
      cup: {
        id: 's1-1',
        season: 1,
        edition: 1,
        opensAt: '2026-10-08T15:00:00.000Z',
        closesAt: '2026-10-12T15:00:00.000Z',
        drawAt: '2026-10-13T03:00:00.000Z',
        rounds: [],
        capacity: 64,
        minFilled: 8,
      },
      phase: 'open',
      entries: 12,
      teams: [{ teamId: 'a', name: '서울FC', owner: 'x', logo: null, ovr: 80 }],
      groups: [],
      matches: [],
      championTeamId: null,
    };
    expect(phaseLine(base)).toBe('12/64팀 신청 · 10월 12일 23:59까지');
    expect(phaseLine({ ...base, phase: 'soon' })).toBe('10월 9일 00:00부터 신청받아요.');
    expect(phaseLine({ ...base, phase: 'closed' })).toBe('10월 13일 12:00에 조를 추첨해요.');
    expect(phaseLine({ ...base, phase: 'done', championTeamId: 'a' })).toBe('우승 서울FC');
    expect(
      phaseLine({ ...base, phase: 'knockout', matches: [match({ round: 'qf', slot: 0 })] }),
    ).toBe('8강 진행 중이에요.');
  });
});
