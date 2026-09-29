import { describe, expect, it } from 'vitest';
import { evalShot, isShot, judgeShot, readDrag, SPOT, type DragPoint } from './dragShot.js';

// T-10-089 드래그 슛(프로토타입): 끈 방향·세기·곧은 정도로 공이 닿는 자리를 정하고, 골문 안이면서 키퍼 손이
// 닿지 않으면 골이다. 흩어짐·키퍼 방향 난수는 테스트에서 고정한다.
const line = (dx: number, dy: number, ms: number, n = 8): DragPoint[] =>
  Array.from({ length: n + 1 }, (_, i) => ({
    x: SPOT.x + (dx * i) / n,
    y: SPOT.y + (dy * i) / n,
    t: (ms * i) / n,
  }));
/** 흩어짐 0(가우스 난수 0이 나오게), 키퍼는 k로 고정. */
const fixed = (k: number) => {
  const seq = [Math.exp(-0.5 * 0), 0.25, Math.exp(-0.5 * 0), 0.25, k];
  let i = 0;
  return () => seq[i++ % seq.length]!;
};

describe('드래그 슛', () => {
  it('짧거나 아래로 끈 손짓은 슛이 아니다', () => {
    expect(isShot(line(0, -10, 100))).toBe(false);
    expect(isShot(line(0, 60, 100))).toBe(false);
    expect(isShot(line(10, -60, 100))).toBe(true);
  });

  it('방향은 겨냥을, 떼기 직전 속도는 세기를, 휜 경로는 곧은 정도를 정한다', () => {
    const left = readDrag(line(-30, -80, 110));
    expect(left.aimX).toBeLessThan(SPOT.x - 30);
    expect(readDrag(line(0, -80, 60)).power).toBeGreaterThan(readDrag(line(0, -80, 240)).power);
    expect(left.straight).toBeCloseTo(1);
    const bent = [
      ...line(0, -40, 60, 4),
      ...line(0, -40, 60, 4).map((p) => ({ x: p.x + 30, y: p.y - 40, t: p.t + 60 })),
    ];
    expect(readDrag(bent).straight).toBeLessThan(0.9);
  });

  it('키퍼 반대쪽 구석은 골, 같은 쪽 가까이는 선방, 너무 세면 뜬다', () => {
    const shot = { aimX: SPOT.x - 58, power: 1, straight: 1 };
    expect(judgeShot(shot, 0.72, fixed(0.5)).outcome).toBe('goal'); // 키퍼 오른쪽
    expect(judgeShot({ ...shot, aimX: SPOT.x - 44 }, 0.72, fixed(0.1)).outcome).toBe('saved'); // 키퍼 왼쪽
    expect(judgeShot({ ...shot, power: 1.6 }, 0.72, fixed(0.5)).outcome).toBe('over');
    expect(judgeShot({ ...shot, aimX: SPOT.x - 120 }, 0.72, fixed(0.5)).outcome).toBe('wide');
  });

  it('evalShot은 경로를 읽어 판정한다', () => {
    const r = evalShot(line(-25, -90, 100), 0.72, fixed(0.5));
    expect(['goal', 'saved', 'post', 'over', 'wide']).toContain(r.outcome);
    expect(r.ok).toBe(r.outcome === 'goal');
  });
});
