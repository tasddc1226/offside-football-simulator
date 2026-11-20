import { describe, expect, it } from 'vitest';
import {
  passNudgeDue,
  passNudgeRetired,
  passNudgeSeen,
  passNudgeShown,
  type PassNudgeState,
} from './passNudge';

const seen = (progress: number, owned = false, season = 2) =>
  passNudgeSeen(null, { season, owned, progress, tier: 1, claimed: 0 });

describe('passNudge', () => {
  it('기준을 처음 넘길 때만 후보가 된다', () => {
    let s: PassNudgeState | null = seen(3);
    s = passNudgeRetired(s, 1, 2);
    expect(s?.pending).toBeNull();
    s = passNudgeRetired(s, 1, 2);
    expect(s).toMatchObject({ progress: 5, pending: 5 });
    expect(passNudgeDue(s, 0, 2)).toBe(5);
  });

  it('여러 기준을 한 번에 넘기면 가장 높은 하나만 남긴다', () => {
    const s = passNudgeRetired(seen(4), 12, 2);
    expect(s).toMatchObject({ progress: 16, pending: 15 });
  });

  it('패스가 있으면 후보를 만들지 않는다', () => {
    const s = passNudgeRetired(seen(4, true), 3, 2);
    expect(s).toMatchObject({ progress: 4, pending: null });
    expect(passNudgeDue(s, 0, 2)).toBeNull();
  });

  it('시즌이 바뀌면 버린다', () => {
    expect(passNudgeRetired(seen(4), 1, 3)).toBeNull();
    expect(passNudgeDue(passNudgeRetired(seen(4), 1, 2), 0, 3)).toBeNull();
  });

  it('보인 뒤 7일 동안은 새 기준을 넘겨도 보이지 않는다', () => {
    const day = 86_400_000;
    let s = passNudgeRetired(seen(4), 1, 2)!;
    s = passNudgeShown(s, 1000);
    expect(passNudgeDue(s, 1000, 2)).toBeNull();
    s = passNudgeRetired(s, 4, 2)!;
    expect(s.pending).toBe(9);
    expect(passNudgeDue(s, 1000 + 6 * day, 2)).toBeNull();
    expect(passNudgeDue(s, 1000 + 7 * day, 2)).toBe(9);
  });

  it('패스 화면을 다시 열면 서버 진행도로 맞추고, 샀으면 후보를 지운다', () => {
    const s = passNudgeRetired(seen(4), 1, 2)!;
    expect(
      passNudgeSeen(s, { season: 2, owned: false, progress: 7, tier: 6, claimed: 0 }),
    ).toMatchObject({ progress: 7, pending: 5 });
    expect(
      passNudgeSeen(s, { season: 2, owned: true, progress: 7, tier: 6, claimed: 0 }).pending,
    ).toBeNull();
    expect(
      passNudgeSeen(s, { season: 3, owned: false, progress: 0, tier: 1, claimed: 0 }),
    ).toMatchObject({ season: 3, pending: null, hideUntil: 0 });
  });
});
