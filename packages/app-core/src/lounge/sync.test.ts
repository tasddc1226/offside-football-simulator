import { describe, expect, it } from 'vitest';
import type {
  FieldClientEvent,
  FieldGoalRow,
  FieldServerEvent,
} from '@offside/contracts/lounge-field';
import { addActor, createWorld, kick, stepFrame, steer, PITCH_L, PITCH_W } from './field.js';
import { FieldSync, type FieldScore } from './sync.js';

/** 두 사람(웹 · 앱)이 서버를 거쳐 주고받는 상황. 서버는 받은 이벤트에 작성자를 붙여 상대에게 넘기고 골을 센다. */
function pair() {
  const names: Record<string, string> = { aaaa: 'A', bbbb: 'B' };
  const tally: FieldGoalRow[] = [];
  const queue: { to: string; e: FieldServerEvent }[] = [];
  const make = (me: string, other: string) => {
    const world = createWorld();
    const scores: FieldScore[] = [];
    const send = (e: FieldClientEvent) => {
      if (e.t === 'field') return true;
      if (e.t === 'goal') {
        const row = tally.find((r) => r.a === me);
        if (row) row.goals++;
        else tally.push({ a: me, n: names[me]!, goals: 1 });
        const g: FieldServerEvent = {
          t: 'goal',
          a: me,
          n: names[me]!,
          side: e.side,
          score: tally.map((r) => ({ ...r })),
          day: 'd',
        };
        queue.push({ to: me, e: g }, { to: other, e: g });
        return true;
      }
      if (e.t === 'pos') queue.push({ to: other, e: { ...e, a: me, n: names[me]! } });
      else queue.push({ to: other, e: { ...e, a: me } as FieldServerEvent });
      return true;
    };
    const sync = new FieldSync(
      world,
      send,
      () => me,
      (s) => scores.push(s),
    );
    const self = addActor(world, me, names[me]!, { x: 10, y: 12 });
    return { world, sync, self, scores };
  };
  const a = make('aaaa', 'bbbb');
  const b = make('bbbb', 'aaaa');
  const flush = (now: number) => {
    while (queue.length) {
      const { to, e } = queue.shift()!;
      (to === 'aaaa' ? a : b).sync.handle(e, now);
    }
  };
  /** 두 화면을 dt씩 함께 돌린다. */
  const run = (from: number, ms: number, each?: (now: number) => void) => {
    for (let t = 0; t < ms; t += 50) {
      const now = from + t;
      each?.(now);
      for (const [p, id] of [
        [a, 'aaaa'],
        [b, 'bbbb'],
      ] as const) {
        if (stepFrame(p.world, 0.05, now, id) !== null && p.world.goal?.byId === id)
          p.sync.goal(p.world.goal.side);
        p.sync.tick(now);
      }
      flush(now);
    }
  };
  return { a, b, run, flush };
}

describe('T-11-600 라운지 필드 동기화(FieldSync)', () => {
  it('움직이면 상대 화면의 내 선수가 그 자리로 따라온다', () => {
    const { a, b, run } = pair();
    a.self.x = 5;
    run(0, 1000, () => steer(a.self, 0, 1));
    // 움직이는 동안은 조금 늦게 따라오고, 멈추면 그 자리에 붙는다.
    run(1000, 600, () => steer(a.self, 0, 0));
    const ghost = b.world.actors.get('aaaa')!;
    expect(ghost.net).not.toBeNull();
    expect(Math.abs(ghost.x - a.self.x)).toBeLessThan(0.1);
    expect(Math.abs(ghost.y - a.self.y)).toBeLessThan(0.1);
    expect(a.self.y).toBeGreaterThan(15);
  });

  it('찬 공은 상대 화면에서도 같은 공이 되고, 마지막으로 찬 사람이 공 주인이 된다', () => {
    const { a, b, run, flush } = pair();
    b.self.x = 30;
    a.world.ball = { x: 10.6, y: 12, z: 0, vx: 0, vy: 0, vz: 0 };
    a.self.fx = 1;
    a.self.fy = 0;
    expect(kick(a.world, a.self)).toBe(true);
    a.sync.kicked(0);
    flush(0);
    expect(b.world.touch).toBe('aaaa');
    expect(b.world.ball.vx).toBeGreaterThan(10);
    run(0, 400);
    expect(Math.abs(b.world.ball.x - a.world.ball.x)).toBeLessThan(0.5);
  });

  it('골은 찬 사람 화면만 정하고, 서버가 센 표와 골 연출이 상대에게도 간다', () => {
    const { a, b, run } = pair();
    b.self.y = 3;
    // A가 오른쪽 골대 앞에서 찬다.
    a.self.x = PITCH_L - 4;
    a.self.y = PITCH_W / 2;
    a.world.ball = { x: PITCH_L - 3.4, y: PITCH_W / 2, z: 0, vx: 0, vy: 0, vz: 0 };
    a.self.fx = 1;
    a.self.fy = 0;
    kick(a.world, a.self);
    a.sync.kicked(0);
    run(0, 1500);
    expect(a.world.goal).toMatchObject({ side: 1, byId: 'aaaa' });
    expect(b.world.goal).toMatchObject({ side: 1, byId: 'aaaa', by: 'A' });
    expect(b.scores.at(-1)?.rows).toEqual([{ a: 'aaaa', n: 'A', goals: 1 }]);
    // B 화면이 따로 골을 세지 않는다(한 골만).
    expect(a.scores.at(-1)?.rows).toEqual([{ a: 'aaaa', n: 'A', goals: 1 }]);
  });

  it('새로 필드를 열면 받은 공 상태 · 다른 사람 자리 · 오늘의 득점을 그대로 둔다', () => {
    const { b } = pair();
    b.sync.handle(
      {
        t: 'field',
        peers: [{ a: 'aaaa', n: 'A', x: 3, y: 4, fx: 1, fy: 0 }],
        score: [{ a: 'aaaa', n: 'A', goals: 2 }],
        day: '2026-10-31',
        ball: { a: 'aaaa', x: 20, y: 5, z: 0, vx: 0, vy: 0, vz: 0 },
      },
      0,
    );
    expect(b.world.ball).toMatchObject({ x: 20, y: 5 });
    expect(b.world.touch).toBe('aaaa');
    expect(b.world.actors.get('aaaa')).toMatchObject({ x: 3, y: 4 });
    expect(b.scores.at(-1)).toEqual({ rows: [{ a: 'aaaa', n: 'A', goals: 2 }], day: '2026-10-31' });
  });

  it('프레임이 느린 기기에서도 같은 시간에 같은 거리를 걷는다', () => {
    const fast = createWorld();
    const slow = createWorld();
    const f = addActor(fast, 'me', 'ME', { x: 5, y: 12 });
    const s = addActor(slow, 'me', 'ME', { x: 5, y: 12 });
    for (let t = 0; t < 1000; t += 16) {
      steer(f, 1, 0);
      stepFrame(fast, 0.016, t, 'me');
    }
    for (let t = 0; t < 1000; t += 100) {
      steer(s, 1, 0);
      stepFrame(slow, 0.1, t, 'me');
    }
    expect(Math.abs(f.x - s.x)).toBeLessThan(0.3);
  });
});
