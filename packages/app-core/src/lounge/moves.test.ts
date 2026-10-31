import { describe, expect, it } from 'vitest';
import { addActor, createWorld, stepWorld, tackle, trick } from './field.js';

function setup() {
  const world = createWorld();
  const me = addActor(world, 'me', 'ME', { x: 10, y: 12 });
  me.fx = 1;
  me.fy = 0;
  return { world, me };
}
function run(world: ReturnType<typeof createWorld>, from: number, ms: number) {
  for (let t = 0; t < ms; t += 16) stepWorld(world, 0.016, from + t, 'me');
}

describe('태클 · 개인기', () => {
  it('태클은 앞으로 미끄러지며 공을 쳐 내고 닿은 선수를 넘어뜨린다', () => {
    const { world, me } = setup();
    const other = addActor(world, 'o', 'O', { x: 11.5, y: 12 });
    other.idleUntil = Number.MAX_SAFE_INTEGER;
    world.ball.x = 11.2;
    world.ball.y = 12;
    expect(tackle(world, me, 1000)).toBe(true);
    // 쿨다운 동안은 다시 못 한다.
    expect(tackle(world, me, 1100)).toBe(false);
    run(world, 1000, 300);
    expect(me.x).toBeGreaterThan(11);
    expect(other.fallUntil).toBeGreaterThan(1000);
    expect(world.ball.vx).toBeGreaterThan(3);
    expect(world.touch).toBe('me');
  });

  it('개인기는 플릭 → 마르세유 턴 → 헛다리 순서로 돌아간다', () => {
    const { world, me } = setup();
    world.ball.x = 30;
    const kinds: string[] = [];
    let now = 1000;
    for (let i = 0; i < 4; i++) {
      kinds.push(trick(world, me, now) ?? 'none');
      run(world, now, 1000);
      now += 1000;
    }
    expect(kinds).toEqual(['flick', 'spin', 'stepover', 'flick']);
  });

  it('공을 데리고 한 마르세유 턴은 끝날 때까지 공을 발밑에 붙여 둔다', () => {
    const { world, me } = setup();
    me.trickN = 1;
    world.ball.x = 10.6;
    world.ball.y = 12;
    expect(trick(world, me, 1000)).toBe('spin');
    run(world, 1000, 400);
    expect(Math.hypot(world.ball.x - me.x, world.ball.y - me.y)).toBeLessThan(0.7);
  });
});
