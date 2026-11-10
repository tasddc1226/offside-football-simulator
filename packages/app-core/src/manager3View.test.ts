// T-11-689 감독 커리어 3 선수단 정렬 · 재계약 요구 주급 줄.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ManagerCareer } from '@offside/contracts';
import { M3_ROLES, acceptOffer, renewalEventWage, type M3Event } from '@offside/game/manager3';
import { setStorage } from '@offside/game/storage';
import { fmtValue } from './format.js';
import { loadManager3State } from './manager3.js';
import { eventView, sortSquad } from './manager3View.js';

const career: ManagerCareer = {
  id: 'mgr_00000000-0000-4000-8000-000000000689',
  careerId: '00000000-0000-4000-8000-000000000002',
  status: 'active',
  engine: 3,
  seed: 689,
  origin: {
    pos: 'MF',
    dpos: 'CM',
    seasons: 15,
    apps: 420,
    clubs: 3,
    trophies: 4,
    caps: 30,
    peak: 86,
    legendScore: 650,
    retireAge: 34,
    nation: null,
  },
  result: null,
  publicName: null,
  number: null,
  startedAt: '2026-11-10T00:00:00.000Z',
  finishedAt: null,
};

function clubState() {
  const s = loadManager3State(career, '감독');
  acceptOffer(s, 0);
  expect(s.squad.length).toBeGreaterThan(10);
  return s;
}

describe('감독 커리어 3 화면 (T-11-689)', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
  });

  it('선수단을 포지션 · OVR · 주급 순으로 정렬하고 원래 순서는 그대로 둔다', () => {
    const s = clubState();
    const before = s.squad.map((p) => p.id);
    const role = (r: (typeof M3_ROLES)[number]) => M3_ROLES.indexOf(r);

    const pos = sortSquad(s.squad, 'pos');
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1]!;
      const b = pos[i]!;
      expect(role(a.role) < role(b.role) || (a.role === b.role && a.ovr >= b.ovr)).toBe(true);
    }
    expect(pos[0]!.role).toBe('GK');

    const ovr = sortSquad(s.squad, 'ovr').map((p) => p.ovr);
    expect(ovr).toEqual([...ovr].sort((a, b) => b - a));
    const wage = sortSquad(s.squad, 'wage').map((p) => p.wage);
    expect(wage).toEqual([...wage].sort((a, b) => b - a));

    expect(s.squad.map((p) => p.id)).toEqual(before);
    expect(sortSquad(s.squad, 'wage')).toHaveLength(before.length);
  });

  it('재계약 요구는 답하기 전 지금 주급과 받아들일 때 주급을, 받아들인 뒤 새 주급을 보여 준다', () => {
    const s = clubState();
    const p = s.squad[0]!;
    p.wage = 12_300;
    p.contract = 1;
    const ev: M3Event = { kind: 'renewal', id: 'renewal', player: p.id, choice: null };
    const next = renewalEventWage(p);
    expect(next).toBe(16_000);

    const open = eventView(s, ev);
    expect(open.detail).toBe(
      `지금 주급 ${fmtValue(12_300)} · 재계약하면 ${fmtValue(16_000)} · 계약 1시즌 남음`,
    );

    p.wage = next;
    p.contract = 3;
    expect(eventView(s, { ...ev, choice: 0 }).detail).toBe(
      `새 주급 ${fmtValue(16_000)} · 계약 3시즌`,
    );
    expect(eventView(s, { ...ev, choice: 1 }).detail).toBeNull();
    // 다른 이야기는 숫자 줄이 없다.
    expect(
      eventView(s, { kind: 'playtime', id: 'playtime', player: p.id, choice: null }).detail,
    ).toBeNull();
  });
});
