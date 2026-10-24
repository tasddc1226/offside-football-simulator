import { describe, expect, it } from 'vitest';
import './index.js';
import { growthDirection, newGame, RATING_BASE, simBlock } from './engine.js';
import { playPhase } from './turn.js';
import { clamp, createRng, setActiveRng } from './rng.js';
import { TYPES, type Pos } from './data.js';

// T-11-379 평점 구성 · 성장 방향 — 설명용 값이 실제 평점 · 능력치와 맞는지 본다.
const player = (pos: Pos, seed = 7) => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: 'a', number: 9, pos, foot: '오른발', type: TYPES[pos][0]!.id, trait: 'late' },
    seed,
  );
  playPhase(s); // 프리시즌을 지나 리그 구간으로
  return s;
};

describe('T-11-379 평점 구성', () => {
  it('뛴 경기의 구성을 더해 반올림 · 상한을 씌우면 그 경기 평점이다', () => {
    let played = 0;
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as const) {
      const s = player(pos);
      for (let k = 0; k < 4; k++) {
        const b = simBlock(s);
        for (const m of b.games) {
          if (!m.mins) {
            expect(m.parts).toBeUndefined();
            continue;
          }
          played++;
          const p = m.parts!;
          const sum =
            RATING_BASE +
            p.goals +
            p.assists +
            (p.ovrEdge + p.form + p.cond + p.morale) +
            p.cs +
            p.def +
            p.result +
            p.luck;
          expect(clamp(Math.round(sum * 10) / 10, 4.5, 10)).toBeCloseTo(m.rating!, 5);
          expect(p.goals).toBeCloseTo((m.g ?? 0) * 0.9, 9);
        }
      }
    }
    expect(played).toBeGreaterThan(10);
  });
});

describe('T-11-379 성장 방향', () => {
  it('공격수는 골, 미드필더는 도움, 수비수 · 골키퍼는 수비 능력치를 본다', () => {
    const fw = growthDirection(player('FW'));
    expect(fw).toMatchObject({ kind: 'goal', attr: 'sho', pct: 60 });
    expect(growthDirection(player('MF'))).toMatchObject({ kind: 'assist', attr: 'pas', pct: 70 });
    expect(growthDirection(player('DF')).kind).toBe('def');
    expect(growthDirection(player('GK')).kind).toBe('def');
  });

  it('공격 능력치가 리그 평균보다 충분히 높으면 더 올려도 덜 오르는 구간이라고 알린다', () => {
    const s = player('FW');
    expect(growthDirection(s)).toMatchObject({ knee: false });
    for (const k of ['sho', 'dri', 'pac'] as const) s.attrs[k] = 99;
    expect(growthDirection(s)).toMatchObject({ knee: true });
  });
});
