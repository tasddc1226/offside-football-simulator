import { describe, expect, it } from 'vitest';
import { MANAGER_EVENTS, newManagerCareer, type ManagerState } from '@offside/game/manager';
import { choiceOddsLabels, eventOutcome, managerBar, managerSteps, statDelta } from './manager.js';

const ORIGIN = {
  pos: 'MF' as const,
  dpos: 'CM' as const,
  seasons: 15,
  apps: 420,
  clubs: 3,
  trophies: 4,
  caps: 30,
  peak: 84,
  legendScore: 700,
  retireAge: 36,
  nation: 'KR',
};
const start = (): ManagerState =>
  newManagerCareer({ id: 'mgr_t', careerId: 'c1', seed: 7, origin: ORIGIN, name: null });
const idle = { answered: false, live: false };

describe('T-11-329 감독 진행 화면', () => {
  it('선택지 확률은 퍼센트, 실패할 수 없으면 확정이다', () => {
    const risky = MANAGER_EVENTS.find((e) => e.choices.some((c) => c.p !== undefined))!;
    const labels = choiceOddsLabels(risky.id);
    risky.choices.forEach((c, i) =>
      expect(labels[i]).toBe(c.p === undefined ? '확정' : `${Math.round(c.p * 100)}%`),
    );
  });

  it('성공/실패는 실패할 수 있는 선택에만 나온다', () => {
    const ev = { id: 'x', choice: 0, result: 'r' };
    expect(eventOutcome(ev)).toBeNull();
    expect(eventOutcome({ ...ev, ok: true })).toEqual({ label: '성공', ok: true });
    expect(eventOutcome({ ...ev, ok: false })).toEqual({ label: '실패', ok: false });
  });

  it('시즌 단계와 아래 고정 버튼은 단계를 따른다', () => {
    const s = start();
    expect(s.phase).toBe('offers');
    expect(managerSteps(s)).toMatchObject({ active: 0, progress: 0.2 });
    expect(managerBar(s, idle)).toBeNull(); // 제의 중 고르기
    expect(managerBar({ ...s, offers: [], club: null }, idle)?.act).toBe('manager-rest');
    expect(managerBar({ ...s, phase: 'setup' }, idle)?.act).toBe('manager-season');
    expect(managerBar({ ...s, phase: 'transfer' }, idle)).toBeNull();
    const ev = { id: MANAGER_EVENTS[0]!.id, choice: null, result: null };
    expect(managerBar({ ...s, phase: 'event', events: [ev] }, idle)).toBeNull();
    expect(
      managerBar({ ...s, phase: 'event', events: [ev] }, { ...idle, answered: true })?.act,
    ).toBe('manager-next');
    expect(managerBar({ ...s, phase: 'event', events: [] }, idle)?.act).toBe('manager-result');
    expect(managerBar({ ...s, phase: 'result' }, { ...idle, live: true })).toBeNull();
    expect(managerBar({ ...s, phase: 'result' }, idle)?.act).toBe('manager-continue');
    expect(managerBar({ ...s, phase: 'done' }, idle)?.act).toBe('manager-finish');
    expect(managerSteps({ phase: 'result' })).toMatchObject({ active: 4, progress: 1 });
    expect(managerSteps({ phase: 'done' })).toBeNull();
  });

  it('상단 칸 변화는 바뀐 칸만 담는다', () => {
    const a = { fame: 40, trust: 50, morale: 55, fans: 50, control: 30, adapt: 20 };
    expect(statDelta(a, { ...a, fame: 43, trust: 48 })).toEqual({ fame: 3, trust: -2 });
    expect(statDelta(a, a)).toEqual({});
  });
});
