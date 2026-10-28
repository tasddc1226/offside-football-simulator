import { describe, expect, it } from 'vitest';
import type { CupMeResponse, CupResponse } from '@offside/contracts';
import { cupLineupBar } from './cupLineupBar.js';

// T-11-436 편성 화면 컵 규칙 줄.
const DRAW = '2026-11-06T03:00:00.000Z';
const BEFORE = '2026-11-03T03:00:00.000Z';
const AFTER = '2026-11-07T03:00:00.000Z';
const divisions = [
  { id: 's2-3-junior', division: 'junior', ovrMax: 78, entries: 12 },
  { id: 's2-3-senior', division: 'senior', ovrMax: 86, entries: 9 },
  { id: 's2-3-master', division: 'master', ovrMax: null, entries: 20 },
] as const;
const cup = (phase: CupResponse['phase'], over: Partial<CupResponse['cup']> = {}): CupResponse => ({
  cup: {
    id: 's2-3-master',
    season: 2,
    edition: 3,
    opensAt: '2026-11-02T12:10:00.000Z',
    closesAt: '2026-11-05T15:00:00.000Z',
    drawAt: DRAW,
    rounds: [],
    capacity: 128,
    minFilled: 8,
    division: 'master',
    ovrMax: null,
    ...over,
  },
  phase,
  entries: 41,
  teams: [],
  groups: [],
  matches: [],
  championTeamId: null,
  divisions: [...divisions],
});
const me = (cupId: string, entered: boolean): CupMeResponse => ({
  cupId,
  ovr: 70,
  entry: entered
    ? {
        teamId: 'tem_00000000-0000-4000-8000-000000000001',
        status: 'active',
        group: null,
        stage: null,
        createdAt: '2026-11-03T00:00:00.000Z',
      }
    : null,
  eligibility: { ok: !entered, reason: null, filled: 8 },
  next: null,
  locked: false,
  rerolls: 0,
});

describe('cupLineupBar', () => {
  it('참가 중이면 내 구간 상한을 구간 목록에서 읽어 보인다', () => {
    const bar = cupLineupBar(cup('group'), me('s2-3-junior', true), { ovr: 75, filled: 9 }, AFTER);
    expect(bar).toMatchObject({
      mode: 'entered',
      ovrText: '팀 OVR 75 / 상한 78(주니어)',
      filledText: '선발 9/최소 8',
      overCap: false,
      short: false,
      block: null,
      notes: [],
    });
  });
  it('추첨 뒤 상한을 넘거나 인원이 모자라면 서버처럼 저장을 막는다', () => {
    const bar = cupLineupBar(cup('group'), me('s2-3-junior', true), { ovr: 80, filled: 7 }, AFTER);
    expect(bar?.overCap).toBe(true);
    expect(bar?.short).toBe(true);
    expect(bar?.block).toBe(
      '주니어 상한(78)을 넘어서 저장할 수 없어요. 팀 OVR을 78 이하로 맞춰 주세요.',
    );
    expect(bar?.notes).toHaveLength(2);
  });
  it('추첨 전 상한을 넘으면 경고만 하고 저장은 막지 않는다', () => {
    const bar = cupLineupBar(cup('open'), me('s2-3-junior', true), { ovr: 80, filled: 8 }, BEFORE);
    expect(bar?.block).toBeNull();
    expect(bar?.notes).toEqual([
      '주니어 상한을 넘었어요. 이대로면 조 추첨 때 OVR에 맞는 구간으로 옮겨져요.',
    ]);
  });
  it('참가 중이면 추첨 전에도 최소 인원이 모자라면 막는다', () => {
    const bar = cupLineupBar(cup('open'), me('s2-3-senior', true), { ovr: 80, filled: 5 }, BEFORE);
    expect(bar?.block).toBe('컵 참가 중에는 선발에 내 선수가 8명 이상 있어야 저장할 수 있어요.');
  });
  it('신청 전 접수 기간에는 초안 OVR로 들어갈 구간을 보이고 경고만 한다', () => {
    const bar = cupLineupBar(cup('open'), me('s2-3-junior', false), { ovr: 84, filled: 5 }, BEFORE);
    expect(bar).toMatchObject({
      mode: 'open',
      ovrText: '팀 OVR 84 / 상한 86(시니어)',
      overCap: false,
      short: true,
      block: null,
      notes: ['컵에 신청하려면 선발에 내 선수가 8명 이상 있어야 해요.'],
    });
    const top = cupLineupBar(cup('open'), me('s2-3-master', false), { ovr: 95, filled: 8 }, BEFORE);
    expect(top?.ovrText).toBe('팀 OVR 95 · 마스터(상한 없음)');
  });
  it('신청하지 않았고 접수 중이 아니거나, 탈락했으면 줄이 없다', () => {
    expect(
      cupLineupBar(cup('group'), me('s2-3-junior', false), { ovr: 70, filled: 8 }, AFTER),
    ).toBeNull();
    const out = me('s2-3-junior', true);
    out.entry!.status = 'out';
    expect(cupLineupBar(cup('knockout'), out, { ovr: 70, filled: 8 }, AFTER)).toBeNull();
    expect(cupLineupBar(null, null, { ovr: 70, filled: 8 }, AFTER)).toBeNull();
  });
  it('통합 대회는 OVR 줄 없이 인원만 본다', () => {
    const one = cup('group', { id: 's1-2', division: undefined, ovrMax: undefined });
    delete one.divisions;
    const bar = cupLineupBar(one, me('s1-2', true), { ovr: 99, filled: 8 }, AFTER);
    expect(bar?.ovrText).toBeNull();
    expect(bar?.block).toBeNull();
  });
});
