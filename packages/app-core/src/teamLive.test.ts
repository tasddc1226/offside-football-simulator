import { describe, expect, it } from 'vitest';
import type { TeamMatch } from './api/team.js';
import {
  FLASH_MS,
  MOMENTUM_START,
  PHASE_LABEL,
  clockText,
  goalMinutesOf,
  lineWaitMs,
  liveScript,
  minuteWaitMs,
  momentumAfter,
  momentumDecay,
  playbackPlan,
  waitMs,
  type LiveLine,
} from './teamLive.js';

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

describe('팀 경기 중계 재생 계획', () => {
  const m = match({
    events: [
      goal(12, 'home', '김공격', '박도움'),
      goal(55, 'away', '이득점'),
      goal(88, 'home', '김공격'),
    ],
  });
  const script = liveScript(m, plain);

  /** 옛 웹·모바일 재생 루프가 하던 일을 그대로 적은 기준 구현(전엔 두 앱에 글자 그대로 있었다). */
  function reference(lines: LiveLine[]) {
    const log: string[] = [];
    const goalMinutes = lines.filter((l) => l.kind === 'goal').map((l) => l.minute);
    let momentum = 0.5;
    const show = (i: number) => {
      const l = lines[i]!;
      log.push(`show ${i}`);
      if (l.side && l.kind !== 'corner') {
        const push = l.kind === 'goal' ? 0.3 : l.kind === 'build' ? 0.2 : 0.12;
        momentum = Math.min(0.9, Math.max(0.1, momentum + (l.side === 'home' ? push : -push)));
      }
      log.push(`mom ${momentum.toFixed(6)}`);
    };
    let i = 0;
    for (let min = 0; min <= 90; min++) {
      log.push(`clock ${min}`);
      log.push('extra 0');
      if (min === 46) log.push('phase 2nd');
      while (i < lines.length && lines[i]!.minute === min && !lines[i]!.extra) {
        const k = lines[i]!.kind;
        show(i++);
        log.push(`sleep ${k === 'goal' ? 1700 : k === 'build' ? 900 : 520}`);
      }
      while (i < lines.length && lines[i]!.minute === min && lines[i]!.extra) {
        const l = lines[i]!;
        for (let x = 1; x <= l.extra!; x++) {
          log.push(`extra ${x}`);
          log.push('sleep 260');
        }
        show(i++);
        if (l.kind === 'ht') {
          log.push('phase ht');
          log.push('sleep 1600');
        } else if (l.kind === 'ft') log.push('phase ft');
      }
      momentum += (0.5 - momentum) * 0.08;
      log.push(`mom ${momentum.toFixed(6)}`);
      const near = goalMinutes.some((g) => g > min && g - min <= 2);
      log.push(`sleep ${near ? 700 : 240}`);
    }
    return log;
  }

  /** 새 계획을 앱이 하는 대로 풀어 적는다. */
  function play(lines: LiveLine[]) {
    const log: string[] = [];
    let momentum = MOMENTUM_START;
    for (const s of playbackPlan(lines)) {
      if (s.clock !== undefined) log.push(`clock ${s.clock}`);
      if (s.extra !== undefined) log.push(`extra ${s.extra}`);
      if (s.show !== undefined) {
        log.push(`show ${s.show}`);
        momentum = momentumAfter(momentum, lines[s.show]!);
        log.push(`mom ${momentum.toFixed(6)}`);
      }
      if (s.phase) log.push(`phase ${s.phase}`);
      if (s.decay) {
        momentum = momentumDecay(momentum);
        log.push(`mom ${momentum.toFixed(6)}`);
      }
      if (s.wait > 0) log.push(`sleep ${s.wait}`);
    }
    return log;
  }

  it('옛 재생 루프와 같은 순서·대기·흐름으로 풀린다', () => {
    expect(play(script)).toEqual(reference(script));
    const quiet = liveScript(
      match({ id: 'mat_q', home: side('A', 0), away: side('B', 0), events: [] }),
      plain,
    );
    expect(play(quiet)).toEqual(reference(quiet));
  });

  it('모든 중계 줄을 한 번씩, 대본 순서대로 보여 준다', () => {
    const shown = playbackPlan(script).flatMap((s) => (s.show === undefined ? [] : [s.show]));
    expect(shown).toEqual(script.map((_, i) => i));
  });

  it('0분부터 90분까지 시계가 한 번씩 흐르고, 46분에 후반, 하프타임 줄에서 멈추고 경기 종료로 끝난다', () => {
    const plan = playbackPlan(script);
    expect(plan.filter((s) => s.clock !== undefined).map((s) => s.clock)).toEqual(
      Array.from({ length: 91 }, (_, i) => i),
    );
    expect(plan.filter((s) => s.phase).map((s) => [s.phase, s.wait])).toEqual([
      ['ht', 1600],
      ['2nd', 0],
      ['ft', 0],
    ]);
    expect(plan.find((s) => s.phase === '2nd')!.clock).toBe(46);
    const last = plan.at(-1)!;
    expect(last).toEqual({ decay: true, wait: 240 });
    expect(script[plan.findLast((s) => s.show !== undefined)!.show!]!.kind).toBe('ft');
  });

  it('추가시간 줄 앞에는 추가시간 시계가 1부터 올라간다', () => {
    const plan = playbackPlan(script);
    const ht = script.findIndex((l) => l.kind === 'ht');
    const at = plan.findIndex((s) => s.show === ht);
    const ticks = script[ht]!.extra!;
    expect(plan.slice(at - ticks, at).map((s) => [s.extra, s.wait])).toEqual(
      Array.from({ length: ticks }, (_, k) => [k + 1, 260]),
    );
  });

  it('줄 종류별 대기: 골 1700 · 빌드업 900 · 나머지 520, 골 2분 전부터는 시계가 느려진다', () => {
    expect([
      lineWaitMs('goal'),
      lineWaitMs('build'),
      lineWaitMs('save'),
      lineWaitMs('kickoff'),
    ]).toEqual([1700, 900, 520, 520]);
    const plan = playbackPlan(script);
    const waitAfter = (min: number) => {
      const i = plan.findIndex((s) => s.clock === min + 1);
      return plan[i - 1]!.wait;
    };
    expect([waitAfter(9), waitAfter(10), waitAfter(11), waitAfter(12), waitAfter(20)]).toEqual([
      240, 700, 700, 240, 240,
    ]);
    expect(minuteWaitMs(true)).toBe(700);
  });

  it('경기 흐름: 홈 줄은 오르고 원정 줄은 내리며 0.1~0.9에 갇히고, 코너킥은 그대로, 분마다 가운데로 돌아온다', () => {
    expect(momentumAfter(0.5, { kind: 'goal', side: 'home' })).toBeCloseTo(0.8);
    expect(momentumAfter(0.5, { kind: 'build', side: 'away' })).toBeCloseTo(0.3);
    expect(momentumAfter(0.5, { kind: 'chance', side: 'home' })).toBeCloseTo(0.62);
    expect(momentumAfter(0.5, { kind: 'corner', side: 'home' })).toBe(0.5);
    expect(momentumAfter(0.5, { kind: 'kickoff' })).toBe(0.5);
    expect(momentumAfter(0.85, { kind: 'goal', side: 'home' })).toBe(0.9);
    expect(momentumAfter(0.15, { kind: 'goal', side: 'away' })).toBe(0.1);
    expect(momentumDecay(0.9)).toBeCloseTo(0.868);
    expect(momentumDecay(0.5)).toBe(0.5);
  });

  it('보조 값: 빠르게는 2.5배, 골 분 목록, 국면 이름', () => {
    expect(waitMs(1700, false)).toBe(1700);
    expect(waitMs(1700, true)).toBe(680);
    expect(waitMs(520, true)).toBe(208);
    expect(goalMinutesOf(script)).toEqual([12, 55, 88]);
    expect(PHASE_LABEL).toEqual({ '1st': '전반', ht: '하프타임', '2nd': '후반', ft: '경기 종료' });
    expect(FLASH_MS).toBe(1800);
  });
});
