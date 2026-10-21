import { setStorage } from '@offside/game/storage';
import { describe, expect, it } from 'vitest';
import {
  attendanceBoard,
  attendancePopupDue,
  boardTotal,
  ITEM_MARK,
  markAttendancePopup,
  rewardText,
} from './attendance-view';

describe('T-11-360 출석 카드', () => {
  it('보상을 한 줄로 쓴다', () => {
    expect(rewardText({ scout: 2, boost: 3 })).toBe('잠재력 강화권 3장, 프리미엄 스카우트권 2장');
    expect(rewardText({})).toBe('');
  });

  it('한 판을 다 채우면 받는 합계', () => {
    expect(boardTotal()).toEqual({
      days: 28,
      reward: '리롤권 20장, 잠재력 강화권 12장, 프리미엄 스카우트권 3장, 선수 이름 변경권 1장',
    });
  });

  it('칸마다 그 날의 아이템을 그린다', () => {
    const { cells } = attendanceBoard(0, false);
    expect(cells[0]).toMatchObject({ n: 1, item: 'reroll', qty: 1, big: false, today: true });
    expect(cells[3]).toMatchObject({ n: 4, item: 'boost', qty: 1, big: false });
    expect(cells[13]).toMatchObject({ n: 14, item: 'scout', qty: 1, big: true });
    expect(cells[27]).toMatchObject({ n: 28, item: 'scout', qty: 2, big: true });
  });

  it('T-11-440 칸마다 모양 기호가 다른 아이템과 그날 보상 전체 글을 함께 준다(색에만 기대지 않는다)', () => {
    const { cells } = attendanceBoard(0, false);
    expect(new Set(Object.values(ITEM_MARK)).size).toBe(3);
    for (const cell of cells) {
      expect(ITEM_MARK[cell.item]).toBeTruthy();
      expect(cell.reward).toContain(`${cell.qty}장`);
    }
    // 큰 보상 칸(28일째)은 칸에 그린 대표 아이템 밖의 보상도 글에 남는다.
    expect(cells[27]!.reward).toContain('프리미엄 스카우트권 2장');
    expect(cells[27]!.reward.split(', ').length).toBeGreaterThan(1);
  });

  it('출석 전이면 오늘 보상, 출석했으면 내일 보상', () => {
    const before = attendanceBoard(6, false);
    expect(before.filled).toBe(6);
    expect(before.cells[6]).toMatchObject({ on: false, today: true });
    expect(before.next).toEqual({ today: true, cell: 7, text: '잠재력 강화권 2장' });
    const after = attendanceBoard(7, true);
    expect(after.cells.filter((c) => c.today)).toHaveLength(0);
    expect(after.next).toEqual({ today: false, cell: 8, text: '리롤권 1장' });
  });

  it('판을 다 채운 날은 가득 찬 판, 다음 날은 새 판이다', () => {
    expect(attendanceBoard(28, true).filled).toBe(28);
    expect(attendanceBoard(28, true).next.cell).toBe(1);
    const fresh = attendanceBoard(28, false);
    expect(fresh.filled).toBe(0);
    expect(fresh.cells[0]?.today).toBe(true);
  });
});

describe('T-11-360 출석 창 자동으로 띄우기', () => {
  const owner = (checkedIn: boolean) =>
    ({
      kind: 'owner',
      att: { today: '', checkedIn, stamps: 1, streak: 1, bestStreak: 1 },
    }) as const;
  const memory = () => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
    return m;
  };
  it('오늘 출석 전인 구단주는 하루 한 번, 출석했거나 세션 없는 첫 방문자는 띄우지 않는다', () => {
    memory();
    expect(attendancePopupDue(owner(true))).toBe(false);
    expect(attendancePopupDue({ kind: 'guest' })).toBe(false);
    expect(attendancePopupDue(owner(false))).toBe(true);
    markAttendancePopup();
    expect(attendancePopupDue(owner(false))).toBe(false);
    memory().set('ft_session', '1');
    expect(attendancePopupDue({ kind: 'guest' })).toBe(true);
  });
});
