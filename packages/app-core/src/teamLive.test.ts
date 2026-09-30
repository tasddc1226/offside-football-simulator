import { describe, expect, it } from 'vitest';
import type { TeamMatch } from './api/team.js';
import { clockText, liveScript } from './teamLive.js';

const side = (name: string, goals: number, ovr = 70) => ({
  teamId: `tem_${name}`,
  name,
  owner: '감독',
  formation: '4-3-3' as const,
  ovr,
  goals,
  ratingChange: null,
});
const goal = (
  minute: number,
  s: 'home' | 'away',
  scorer: string,
  assist: string | null = null,
) => ({
  minute,
  side: s,
  scorer,
  assist,
  scorerId: null,
  assistId: null,
});
const match = (over: Partial<TeamMatch> = {}): TeamMatch => ({
  id: 'mat_live-1',
  home: side('우리 FC', 2),
  away: side('라이벌 FC', 1),
  events: [
    goal(12, 'home', '김공격', '박도움'),
    goal(55, 'away', '익명의 공격수 No.7'),
    goal(88, 'home', '김공격'),
  ],
  mine: 'home',
  createdAt: '2026-09-29T03:00:00.000Z',
  ...over,
});
const plain = (_id: string | null, fallback: string) => fallback;

describe('T-10-097 팀 경기 문자중계 대본', () => {
  it('골 줄의 스코어를 따라가면 서버 결과와 같고, 킥오프로 시작해 경기 종료로 끝난다', () => {
    const m = match({ home: side('우리 FC', 2), away: side('라이벌 FC', 1) });
    const lines = liveScript(m, plain);
    const goals = lines.filter((l) => l.kind === 'goal');
    expect(goals.map((l) => [l.minute, l.score])).toEqual([
      [12, [1, 0]],
      [55, [1, 1]],
      [88, [2, 1]],
    ]);
    expect(lines[0]!.kind).toBe('kickoff');
    expect(lines.at(-1)!.kind).toBe('ft');
    expect(lines.at(-1)!.text).toContain('우리 FC 2 : 1 라이벌 FC');
    expect(lines.find((l) => l.kind === 'ht')!.text).toContain('1 : 0');
    // 시계 순서이고, 골마다 직전에 빌드업 줄이 있다.
    for (let i = 1; i < lines.length; i++)
      expect(lines[i]!.minute).toBeGreaterThanOrEqual(lines[i - 1]!.minute);
    for (const g of goals) {
      const i = lines.indexOf(g);
      expect(lines[i - 1]!.kind).toBe('build');
    }
  });

  it('도움·역전·극장골 문구를 붙이고, 같은 경기는 늘 같은 중계다', () => {
    const lines = liveScript(match(), plain);
    const texts = lines.filter((l) => l.kind === 'goal').map((l) => l.text);
    expect(texts[0]).toBe('골! 우리 FC 김공격! 박도움의 도움.');
    expect(texts[2]).toContain('극장골');
    expect(liveScript(match(), plain)).toEqual(lines);
    expect(liveScript(match({ id: 'mat_other' }), plain)).not.toEqual(lines);
  });

  it('내 선수는 이 기기의 이름으로 부르고, 받침에 맞게 조사를 붙인다', () => {
    const m = match({
      home: side('서울', 1),
      away: side('부산 FC', 0),
      events: [{ ...goal(30, 'home', '익명의 공격수 No.9'), scorerId: 'c-1' }],
    });
    const lines = liveScript(m, (id, fb) => (id === 'c-1' ? '홍길동' : fb));
    expect(lines.find((l) => l.kind === 'goal')!.text).toContain('홍길동');
    expect(lines[0]!.text.startsWith('서울과 부산 FC의 경기')).toBe(true);
  });

  it('골 없는 경기도 중계 줄이 채워지고, 추가시간은 45+N · 90+N으로 적는다', () => {
    const lines = liveScript(match({ home: side('A', 0), away: side('B', 0), events: [] }), plain);
    expect(lines.filter((l) => l.kind === 'goal')).toHaveLength(0);
    expect(lines.length).toBeGreaterThan(8);
    expect(clockText(lines.find((l) => l.kind === 'ht')!)).toMatch(/^45\+[1-3]'$/);
    expect(clockText(lines.at(-1)!)).toMatch(/^90\+[2-5]'$/);
    expect(lines.at(-1)!.text).toContain('승부를 가리지 못했습니다');
  });
});
