import { describe, expect, it } from 'vitest';
import './event-registry.js';
import { TRAITS, TYPES } from './data.js';
import { newGame, resolveChoice } from './engine.js';
import { EVENTS } from './events-data.js';
import { markerAt, offsetToRoll, SWEEP_MS, tapOffset, timingNote, zoneWidth } from './minigame.js';
import { createRng, rnd, setActiveRng } from './rng.js';

// T-10-089 원터치 미니게임: 탭 위치가 구간 안이면 성공, 밖이면 실패. 난수는 탭과 상관없이 한 번 쓴다.
describe('원터치 미니게임', () => {
  it('미니게임 선택지는 모두 확률 판정이 있는 선택지다', () => {
    const mg = EVENTS.flatMap((ev) =>
      ev.choices.flatMap((c, i) => {
        if (!c.mg) return [];
        expect(c.p, `${ev.id}:${i}`).toBeTypeOf('function');
        return [`${ev.id}:${i}:${c.mg.kind}`];
      }),
    );
    expect(mg.sort()).toEqual([
      'fw-one-on-one:0:chip',
      'fw-one-on-one:1:dribble',
      'gk-pk:0:save',
      'gk-pk:1:save',
      'penalty:0:shot',
      'pk-save:0:save',
      'pk-save:1:save',
    ]);
  });

  it('바늘은 SWEEP_MS마다 끝에서 끝으로 왕복한다', () => {
    expect(markerAt(0)).toBe(0);
    expect(markerAt(SWEEP_MS / 2)).toBeCloseTo(0.5);
    expect(markerAt(SWEEP_MS)).toBe(1);
    expect(markerAt(SWEEP_MS * 1.5)).toBeCloseTo(0.5);
    expect(markerAt(SWEEP_MS * 2)).toBe(0);
  });

  it('구간 넓이는 능력치 확률을 따라 넓어지고 범위 안에 머문다', () => {
    expect(zoneWidth(0.3)).toBeLessThan(zoneWidth(0.72));
    expect(zoneWidth(0.5, 'chip')).toBeCloseTo(zoneWidth(0.5) * 0.75);
    expect(zoneWidth(0)).toBe(0.06);
    expect(zoneWidth(1)).toBe(0.36);
  });

  it('구간 안 탭은 p보다 작은 판정값, 밖은 p 이상이다', () => {
    const p = 0.4,
      w = zoneWidth(p),
      c = 0.5;
    for (const x of [c, c - w / 2, c + w / 2, c + w / 4]) {
      expect(offsetToRoll(tapOffset(x, c, w), p)).toBeLessThan(p);
    }
    for (const x of [c + w / 2 + 0.001, 0, 1]) {
      const roll = offsetToRoll(tapOffset(x, c, w), p);
      expect(roll).toBeGreaterThanOrEqual(p);
      expect(roll).toBeLessThan(1);
    }
    expect(timingNote(0.1)).toBe('완벽한 타이밍!');
    expect(timingNote(3)).toBe('타이밍을 놓쳤어요');
  });

  it('탭으로 판정해도 난수는 한 번 쓴다(결과가 같으면 뒤따르는 RNG 흐름도 같다)', () => {
    const run = (tap?: number) => {
      setActiveRng(createRng(7));
      const s = newGame(
        {
          name: '테스트',
          number: 9,
          pos: 'FW',
          foot: '오른발',
          type: TYPES.FW[0]!.id,
          trait: TRAITS[0]!.id,
        },
        7,
      );
      s.phase = 1;
      const r = resolveChoice(s, 'penalty', 0, tap);
      return { ok: r.ok, p: r.p, next: rnd() };
    };
    const base = run();
    const same = run(base.ok ? 0 : 0.999);
    expect(same.ok).toBe(base.ok);
    expect(same.next).toBe(base.next);
    // 탭이 결과를 정한다 — 같은 시드에서도 구간 안이면 성공, 밖이면 실패.
    expect(run(0).ok).toBe(true);
    expect(run(0.999).ok).toBe(false);
  });
});
