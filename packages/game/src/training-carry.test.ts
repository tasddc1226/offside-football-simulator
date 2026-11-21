// T-11-798 이적 시장을 마치고 새 시즌으로 넘어갈 때의 훈련.
import { describe, expect, it } from 'vitest';
import { ATTR_KEYS } from './data.js';
import { TRAININGS, nextSeasonTraining } from './training.js';

describe('T-11-798 새 시즌 훈련', () => {
  it('능력치 훈련은 그대로 이어 간다', () => {
    for (const k of ATTR_KEYS) expect(nextSeasonTraining(k)).toBe(k);
  });

  it('개인 코치 · 미디어 활동 · 휴식은 휴식으로 돌아간다', () => {
    for (const t of ['coach', 'media', 'rest']) expect(nextSeasonTraining(t)).toBe('rest');
  });

  it('모르는 값(옛 세이브 등)은 휴식으로 둔다', () => {
    for (const t of ['', 'unknown', 'Sho']) expect(nextSeasonTraining(t)).toBe('rest');
  });

  it('훈련 목록의 모든 항목을 다룬다', () => {
    for (const t of TRAININGS) expect(nextSeasonTraining(t.id)).toBe(t.attr ? t.id : 'rest');
  });
});
