import { describe, expect, it } from 'vitest';
import type { TeamMatch, TeamMoment } from './api/team.js';
import {
  GroundPlay,
  groundBall,
  groundLineup,
  groundPoses,
  groundSpots,
  momentGround,
  poseTimeline,
} from './matchGround.js';
import { liveScript, type LiveLine } from './teamLive.js';

const side = (name: string, goals: number, formation: '4-3-3' | '4-4-2' | '3-5-2' = '4-3-3') => ({
  teamId: `tem_${name}`,
  name,
  owner: '감독',
  formation,
  ovr: 70,
  goals,
  ratingChange: null,
});
const match = (over: Partial<TeamMatch> = {}): TeamMatch => ({
  id: 'mat_ground-1',
  home: side('우리 FC', 2),
  away: side('라이벌 FC', 1, '4-4-2'),
  events: [
    {
      minute: 23,
      side: 'home',
      scorer: '김공격',
      assist: '박도움',
      scorerId: null,
      assistId: null,
      slot: 'RW',
    },
    {
      minute: 53,
      side: 'away',
      scorer: '마르코',
      assist: null,
      scorerId: null,
      assistId: null,
      slot: 'ST',
    },
    {
      minute: 79,
      side: 'home',
      scorer: '정중원',
      assist: null,
      scorerId: null,
      assistId: null,
      slot: 'CB',
    },
  ],
  mine: 'home',
  createdAt: '2026-10-25T03:00:00.000Z',
  ...over,
});
const plain = (_id: string | null, fallback: string) => fallback;
const inside = ([x, y]: readonly [number, number]) => x >= 0 && x <= 100 && y >= 0 && y <= 100;

describe('T-11-492 2D 그라운드', () => {
  it('두 팀 11명씩, 홈은 왼쪽 진영 · 원정은 오른쪽 진영에 서고 등번호가 겹치지 않는다', () => {
    for (const f of ['4-3-3', '4-4-2', '3-5-2'] as const) {
      const ps = groundLineup({ home: side('A', 0, f), away: side('B', 0, f) });
      const home = ps.filter((p) => p.side === 'home');
      const away = ps.filter((p) => p.side === 'away');
      expect(home).toHaveLength(11);
      expect(away).toHaveLength(11);
      expect(new Set(home.map((p) => p.no)).size).toBe(11);
      expect(home.find((p) => p.slot === 'GK')!.x).toBeLessThan(10);
      expect(away.find((p) => p.slot === 'GK')!.x).toBeGreaterThan(90);
      expect(home.every((p) => p.x < 70)).toBe(true);
      expect(away.every((p) => p.x > 30)).toBe(true);
      // 원정은 홈을 마주 보므로 왼쪽 풀백이 아래쪽에 선다.
      const lb = away.filter((p) => p.slot === 'FB').sort((a, b) => a.lane - b.lane)[0]!;
      expect(lb.y).toBeGreaterThan(50);
    }
  });

  it('모든 줄에 움직임이 있고, 몫의 합이 1이며 공 · 선수는 그라운드 안에 있다', () => {
    const m = match();
    const ps = groundLineup(m);
    let prev = null;
    for (const l of liveScript(m, plain)) {
      const poses = groundPoses(m.id, ps, l, prev);
      expect(poses.length, l.kind).toBeGreaterThan(0);
      expect(poses.reduce((s, p) => s + p.t, 0)).toBeCloseTo(1, 5);
      for (const p of poses) {
        expect(inside(p.ball)).toBe(true);
        for (const q of Object.values(p.moves ?? {})) expect(inside(q)).toBe(true);
      }
      prev = poses.at(-1)!;
    }
  });

  it('골은 넣은 팀이 공격하는 골문 안으로 들어가고, 득점자 이름표가 붙는다', () => {
    const m = match();
    const ps = groundLineup(m);
    const lines = liveScript(m, plain);
    let prev = null;
    const goals: { l: LiveLine; last: ReturnType<typeof groundPoses>[number] }[] = [];
    for (const l of lines) {
      const poses = groundPoses(m.id, ps, l, prev);
      prev = poses.at(-1)!;
      if (l.kind === 'goal') goals.push({ l, last: prev });
    }
    expect(goals).toHaveLength(3);
    for (const { l, last } of goals) {
      expect(last.goal).toBe(l.side);
      expect(last.ball[0]).toBe(l.side === 'home' ? 100 : 0);
      expect(last.ball[1]).toBeGreaterThanOrEqual(46);
      expect(last.ball[1]).toBeLessThanOrEqual(54);
      expect(Object.values(last.tags ?? {})).toContain(l.goal!.scorer);
      const scorer = ps.find((p) => p.key === last.hl)!;
      expect(scorer.side).toBe(l.side);
    }
    // 측면(RW) 득점자는 오른쪽 측면 선수, 수비수(CB) 득점자는 센터백이다.
    expect(ps.find((p) => p.key === goals[0]!.last.hl)!.lane).toBeGreaterThan(50);
    expect(ps.find((p) => p.key === goals[2]!.last.hl)!.slot).toBe('CB');
  });

  it('문구에 맞게 움직인다(오른쪽 측면 줄은 오른쪽 측면으로, 코너킥은 코너 깃발에서)', () => {
    const m = match();
    const ps = groundLineup(m);
    const line = (
      say: string,
      s: 'home' | 'away' = 'home',
      kind: LiveLine['kind'] = 'chance',
    ): LiveLine => ({
      minute: 30,
      kind,
      side: s,
      text: '',
      say,
    });
    // 홈의 오른쪽은 아래(y 큼), 원정의 오른쪽은 위(y 작음).
    expect(groundPoses(m.id, ps, line('chance1'))[0]!.ball[1]).toBeGreaterThan(80);
    expect(groundPoses(m.id, ps, line('chance1', 'away'))[0]!.ball[1]).toBeLessThan(20);
    expect(groundPoses(m.id, ps, line('chance5'))[0]!.ball[1]).toBeLessThan(20);
    const corner = groundPoses(m.id, ps, line('corner1', 'home', 'corner'))[0]!.ball;
    expect(corner[0]).toBeGreaterThan(98);
    expect(corner[1] < 5 || corner[1] > 95).toBe(true);
    // 원정 공격은 왼쪽(홈 골문) 쪽에서 일어난다.
    expect(groundPoses(m.id, ps, line('save3', 'away', 'save')).at(-1)!.ball[0]).toBeLessThan(10);
    // 장면 경기 위기에서 막은 줄(side home)은 우리 골문 앞이다.
    expect(groundPoses(m.id, ps, line('crisisSave', 'home', 'save')).at(-1)!.ball[0]).toBeLessThan(
      10,
    );
  });

  it('T-11-582 세트피스는 문전에 여러 명이 모이고, 열린 플레이 빌드업에는 최전방이 뛰어 든다', () => {
    const m = match();
    const ps = groundLineup(m);
    const line = (say: string): LiveLine => ({
      minute: 78,
      kind: 'build',
      side: 'home',
      text: '',
      say,
      slot: say.startsWith('buildSet') ? 'CB' : 'LW',
    });
    const inBox = (pose: ReturnType<typeof groundPoses>[number], side: 'home' | 'away') =>
      Object.entries(pose.moves ?? {}).filter(([k, [x, y]]) => {
        const p = ps.find((q) => q.key === k)!;
        return p.side === side && p.slot !== 'GK' && x >= 84 && y >= 20 && y <= 80;
      }).length;
    for (const say of ['buildSet1', 'buildSet2']) {
      const last = groundPoses(m.id, ps, line(say)).at(-1)!;
      // 센터백 혼자가 아니라 공격 4명 이상, 수비도 그만큼 붙는다(프리킥은 오프사이드 줄 83 근처).
      const atk = Object.entries(last.moves ?? {}).filter(
        ([k, [x]]) => ps.find((q) => q.key === k)!.side === 'home' && x >= 82,
      ).length;
      expect(atk).toBeGreaterThanOrEqual(4);
      if (say === 'buildSet1') {
        expect(inBox(last, 'away')).toBeGreaterThanOrEqual(4);
        // 코너킥 때 문전에 가지 않은 필드 선수도 하프라인까지 올라온다.
        const spots = groundSpots(ps, last, 0.5).filter((s) => s.side === 'home');
        const field = spots.filter((s) => ps.find((p) => p.key === s.key)!.slot !== 'GK');
        expect(Math.min(...field.map((s) => s.x))).toBeGreaterThanOrEqual(47);
      }
    }
    const st = ps.filter((p) => p.side === 'home' && p.slot === 'ST');
    const wide = groundPoses(m.id, ps, line('buildLeft')).at(-1)!;
    for (const p of st) expect(wide.moves?.[p.key]?.[0]).toBeGreaterThanOrEqual(84);
  });

  it('같은 경기는 늘 같은 움직임이다', () => {
    const run = () => {
      const play = new GroundPlay(match());
      return liveScript(match(), plain).map((l) => play.line(l, 1000));
    };
    expect(run()).toEqual(run());
  });

  it('골 줄은 빌드업부터 공이 지난 길을 남기고, 다음 분에 자세를 푼다', () => {
    const m = match();
    const play = new GroundPlay(m);
    const lines = liveScript(m, plain);
    const gi = lines.findIndex((l) => l.kind === 'goal');
    for (const l of lines.slice(0, gi)) play.line(l, 1000);
    const buildTrail = play.trail.length;
    expect(buildTrail).toBeGreaterThan(0);
    const steps = play.line(lines[gi]!, 2200);
    expect(play.trail.length).toBe(buildTrail + steps.length);
    expect(steps.at(-1)!.at + steps.at(-1)!.dur).toBe(2200);
    expect(play.settle()).toBe(true);
    expect(play.pose).toBeNull();
    expect(play.settle()).toBe(false);
  });

  it('흐름이 홈 쪽이면 선수 · 공이 오른쪽으로 밀리고, 골키퍼는 덜 움직인다', () => {
    const ps = groundLineup(match());
    const even = groundSpots(ps, null, 0.5);
    const press = groundSpots(ps, null, 0.9);
    const st = even.findIndex((p) => p.key === 'h9');
    expect(press[st]!.x).toBeGreaterThan(even[st]!.x);
    expect(press[0]!.x - even[0]!.x).toBeLessThan(press[st]!.x - even[st]!.x);
    expect(groundBall(null, 0.9)[0]).toBeGreaterThan(groundBall(null, 0.5)[0]);
  });

  it('장면 멈춤: 주인공 · 동료만 밝히고 선택지마다 화살표를 긋는다', () => {
    const m = match();
    const ps = groundLineup(m);
    const chance: TeamMoment = {
      index: 0,
      minute: 68,
      kind: 'chance',
      situation: 'st-1v1',
      actor: { name: '김공격', id: 'car_1', slot: 'ST' },
      mate: { name: '박동료', id: 'car_2', slot: 'RW' },
      opp: { name: '최수비', id: null, slot: 'CB' },
      choices: [
        { id: 'drive', pct: 41, mate: false, risk: 0, gain: 0 },
        { id: 'square', pct: 38, mate: true, risk: 0.1, gain: 0 },
        { id: 'round', pct: 47, mate: false, risk: 0.2, gain: 0 },
      ],
    };
    const g = momentGround(ps, chance, plain);
    expect(g.arrows.map((a) => a.n)).toEqual([1, 2, 3]);
    expect(g.arrows[1]!.to).toEqual(g.pose.moves![g.pose.mate!]);
    expect(g.arrows[0]!.to[0]).toBeGreaterThan(99);
    expect(g.arrows.map((a) => a.curve)).toEqual([false, false, true]);
    const spots = groundSpots(ps, g.pose, 0.5);
    const lit = spots.filter((s) => !s.dim);
    expect(
      lit
        .map((s) => s.tag)
        .filter(Boolean)
        .sort(),
    ).toEqual(['김공격', '박동료']);
    expect(spots.filter((s) => s.dim).length).toBeGreaterThan(15);

    const crisis = momentGround(
      ps,
      {
        ...chance,
        kind: 'crisis',
        situation: 'cb-1v1',
        actor: { name: '이수비', id: 'car_3', slot: 'CB' },
        opp: { name: '마르코', id: null, slot: 'ST' },
        choices: [
          { id: 'hold', pct: 60, mate: false, risk: 0, gain: 0 },
          { id: 'dare', pct: 52, mate: false, risk: 0, gain: 0.15 },
        ],
      },
      plain,
    );
    // 위기는 우리 골문(왼쪽) 앞이고, 상대 공격수 이름도 붙는다.
    expect(crisis.pose.ball[0]).toBeLessThan(30);
    expect(Object.values(crisis.pose.tags!)).toContain('마르코');
    expect(crisis.arrows[1]!.curve).toBe(true);
  });

  it('동작 시간표는 몫대로 나누고 합이 전체 시간이다', () => {
    const steps = poseTimeline(
      [
        { t: 0.3, ball: [0, 0] },
        { t: 0.7, ball: [1, 1] },
      ],
      1000,
    );
    expect(steps.map((s) => [s.at, s.dur])).toEqual([
      [0, 300],
      [300, 700],
    ]);
  });
});
