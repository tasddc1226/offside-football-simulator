import { describe, expect, it } from 'vitest';
import { TEAM_DIVISION_KEYS } from './team-division.js';
import {
  PERMANENT_TITLES,
  TITLE_CATEGORIES,
  TITLE_CRITERIA_VERSION,
  TITLE_DIVISION,
  TITLE_GRADES,
  titleLadderOf,
} from './owner-title.js';

describe('T-11-556 permanent title catalog', () => {
  it('ids are unique and every title has a known grade and category', () => {
    expect(new Set(PERMANENT_TITLES.map((t) => t.id)).size).toBe(PERMANENT_TITLES.length);
    for (const t of PERMANENT_TITLES) {
      expect(TITLE_GRADES).toContain(t.grade);
      expect(TITLE_CATEGORIES).toContain(t.category);
      expect(t.target).toBeGreaterThan(0);
    }
    expect(TITLE_CRITERIA_VERSION).toBe(4);
  });

  it('ladders share a metric, a category and climb in target and grade', () => {
    const metrics = new Set(PERMANENT_TITLES.map((t) => t.metric));
    for (const metric of metrics) {
      const ladder = PERMANENT_TITLES.filter((t) => t.metric === metric).sort(
        (a, b) => a.target - b.target,
      );
      expect(new Set(ladder.map((t) => t.target)).size).toBe(ladder.length);
      expect(new Set(ladder.map((t) => t.category)).size).toBe(1);
      for (let i = 1; i < ladder.length; i++)
        expect(TITLE_GRADES.indexOf(ladder[i]!.grade)).toBeGreaterThan(
          TITLE_GRADES.indexOf(ladder[i - 1]!.grade),
        );
    }
    expect(titleLadderOf('owner-developer')).toMatchObject({ step: 1, steps: 3 });
    expect(titleLadderOf('owner-youth-kingdom')).toMatchObject({ step: 3, steps: 3 });
    expect(titleLadderOf('owner-keeper')).toMatchObject({ step: 1, steps: 1 });
    expect(titleLadderOf('owner-unknown')).toBeNull();
  });

  it('exchange is reachable early and division targets match the division keys', () => {
    expect(PERMANENT_TITLES.find((t) => t.id === 'owner-exchange')?.target).toBe(5);
    expect(TEAM_DIVISION_KEYS[TITLE_DIVISION.elite]).toBe('elite2');
    expect(TEAM_DIVISION_KEYS[TITLE_DIVISION.master]).toBe('master');
  });
});
