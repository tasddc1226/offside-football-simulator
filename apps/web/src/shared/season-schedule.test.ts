// SCR-029 일정표 구역 순수 함수(단위 테스트): 평점 소수 1자리·OUT 사유 라벨·컵 라운드 표기·탈락
// 표시·미대결 행 포맷을 검증한다.
import { loadRuleset } from '@offside/content';
import type { FootballSeason, MatchRecord, ScheduleEntry } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { buildScheduleRows, ratingText } from './season-schedule.js';

const ruleset = loadRuleset('1.0.0');
const TEAM_ID = 'seorabeol-united'; // 1부리그(league-tier1) 소속 실제 팀(픽스처 아님, 룰셋 데이터).
const OPPONENT_ID = 'cheongyeon-fc'; // 같은 리그의 다른 실제 팀.

function seasonWith(schedule: ScheduleEntry[], matches: MatchRecord[]): FootballSeason {
  return { teamId: TEAM_ID, schedule, matches } as unknown as FootballSeason;
}

describe('ratingText', () => {
  it('ratingTenths(정수 ×10)를 소수 1자리 문자열로 바꾼다', () => {
    expect(ratingText(72)).toBe('7.2');
    expect(ratingText(100)).toBe('10.0');
  });

  it('null이면 "—"다(미집계 구분, SCR-029 인수 조건)', () => {
    expect(ratingText(null)).toBe('—');
  });
});

describe('buildScheduleRows', () => {
  it('리그 홈 경기: 상대 이름을 룰셋에서 찾고 평점·출전·득실을 그대로 옮긴다', () => {
    const entry: ScheduleEntry = { step: 2, order: 0, competitionId: 'LEAGUE', kind: 'LEAGUE', round: null, opponentId: OPPONENT_ID, home: true };
    const match: MatchRecord = {
      id: '1-2-0',
      step: 2,
      order: 0,
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      round: null,
      opponent: { id: OPPONENT_ID, name: '청연 FC', strength: 80 },
      home: true,
      result: { goalsFor: 2, goalsAgainst: 1, outcome: 'WIN' },
      appearance: 'START',
      outReason: null,
      minutes: 90,
      involvement: 5,
      stats: {} as MatchRecord['stats'],
      ratingTenths: 72,
      cards: { yellow: 0, red: false },
      injuredOff: false,
      chapterId: null,
    };

    const [row] = buildScheduleRows(seasonWith([entry], [match]), ruleset);

    expect(row).toMatchObject({
      step: 2,
      order: 0,
      competitionLabel: '리그',
      opponentName: '청연 FC',
      home: true,
      eliminated: false,
      match: { scoreText: '2:1', appearanceLabel: '선발', minutes: 90, ratingText: '7.2' },
    });
  });

  it('컵 라운드는 "컵 · N라운드"로 표기한다', () => {
    const entry: ScheduleEntry = { step: 3, order: 1, competitionId: 'CUP', kind: 'CUP', round: 'R1', opponentId: OPPONENT_ID, home: false };

    const [row] = buildScheduleRows(seasonWith([entry], []), ruleset);

    expect(row?.competitionLabel).toBe('컵 · 1라운드');
    expect(row?.match).toBeNull();
  });

  it('OUT 출전은 결장 사유를 라벨로 보여준다(NOT_SELECTED·부상 등 outReason)', () => {
    const entry: ScheduleEntry = { step: 5, order: 0, competitionId: 'LEAGUE', kind: 'LEAGUE', round: null, opponentId: OPPONENT_ID, home: true };
    const match: MatchRecord = {
      id: '1-5-0',
      step: 5,
      order: 0,
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      round: null,
      opponent: { id: OPPONENT_ID, name: '청연 FC', strength: 80 },
      home: true,
      result: { goalsFor: 1, goalsAgainst: 1, outcome: 'DRAW' },
      appearance: 'OUT',
      outReason: 'INJURY',
      minutes: 0,
      involvement: 0,
      stats: {} as MatchRecord['stats'],
      ratingTenths: null,
      cards: { yellow: 0, red: false },
      injuredOff: false,
      chapterId: null,
    };

    const [row] = buildScheduleRows(seasonWith([entry], [match]), ruleset);

    expect(row?.match).toMatchObject({ appearanceLabel: '부상', ratingText: '—' });
  });

  it('탈락(skipped: ELIMINATED) 행은 상대 대신 "탈락"을 보여주고 match는 null이다', () => {
    const entry: ScheduleEntry = {
      step: 9,
      order: 0,
      competitionId: 'CUP',
      kind: 'CUP',
      round: 'SEMI',
      opponentId: `${ruleset.cups[0]!.id}-SEMI`,
      home: true,
      skipped: 'ELIMINATED',
    };

    const [row] = buildScheduleRows(seasonWith([entry], []), ruleset);

    expect(row).toMatchObject({ opponentName: '탈락', eliminated: true, match: null });
  });

  it('일정에 대응하는 MatchRecord가 없으면(아직 안 치른 경기) match는 null이다', () => {
    const entry: ScheduleEntry = { step: 6, order: 0, competitionId: 'LEAGUE', kind: 'LEAGUE', round: null, opponentId: OPPONENT_ID, home: false };

    const [row] = buildScheduleRows(seasonWith([entry], []), ruleset);

    expect(row?.match).toBeNull();
  });
});
