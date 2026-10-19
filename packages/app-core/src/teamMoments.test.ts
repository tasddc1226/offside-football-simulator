import { SITUATIONS } from '@offside/contracts/team-moments';
import { describe, expect, it } from 'vitest';
import type { TeamMatch, TeamMoment } from './api/team.js';
import { teamMoments as EN } from './i18n/en/teamMoments.js';
import { teamMoments as JA } from './i18n/ja/teamMoments.js';
import { teamMomentsText as KO } from './i18n/ko/teamMoments.js';
import { liveScript } from './teamLive.js';
import { LiveScore, momentChoices, momentLines, momentScene, pickedLabel } from './teamMoments.js';

const side = (name: string, goals: number) => ({
  teamId: `tem_${name}`,
  name,
  owner: '감독',
  formation: '4-3-3' as const,
  ovr: 70,
  goals,
  ratingChange: null,
});
const match = (events: TeamMatch['events']): TeamMatch => ({
  id: 'mat_1',
  home: side('우리', events.filter((e) => e.side === 'home').length),
  away: side('상대', events.filter((e) => e.side === 'away').length),
  mine: 'home',
  events,
  createdAt: '2026-10-18T00:00:00.000Z',
});
const name = (_id: string | null, fallback: string) => fallback;

const moment = (over: Partial<TeamMoment> = {}): TeamMoment => ({
  index: 0,
  minute: 30,
  kind: 'chance',
  situation: 'st-1v1',
  actor: { name: '김공격', id: 'car_1', slot: 'ST' },
  mate: { name: '박동료', id: 'car_2', slot: 'W' },
  opp: { name: '최수비', id: null, slot: 'CB' },
  choices: [
    { id: 'drive', pct: 38, mate: false, risk: 0, gain: 0 },
    { id: 'square', pct: 42, mate: true, risk: 10, gain: 0 },
    { id: 'round', pct: 48, mate: false, risk: 20, gain: 0 },
  ],
  ...over,
});

describe('장면 문구', () => {
  it('모든 장면 · 선택지에 세 언어 문구가 있다', () => {
    for (const dict of [KO, EN, JA] as unknown as Record<string, unknown>[])
      for (const s of SITUATIONS) {
        expect(dict[`s:${s.id}`], s.id).toBeDefined();
        for (const c of s.choices)
          expect(dict[`c:${s.id}:${c.id}`], `${s.id}:${c.id}`).toBeDefined();
      }
  });

  it('장면 설명과 선택지에 선수 이름 · 확률 · 꼬리표가 들어간다', () => {
    const m = moment();
    expect(momentScene(m, name)).toContain('김공격');
    const cs = momentChoices(m, name);
    expect(cs.map((c) => c.id)).toEqual(['drive', 'square', 'round']);
    expect(cs[1]!.label).toContain('박동료');
    expect(cs[1]!.tags).toHaveLength(2);
    expect(cs[0]!.tags).toEqual([]);
    expect(pickedLabel({ ...m, picked: 'auto' }, name)).toBe(KO.recordAuto);
    expect(pickedLabel({ ...m, picked: 'round' }, name)).toBe('키퍼 제치기');
  });
});

describe('LiveScore', () => {
  it('장면 골이 끼어들면 뒤 골 줄 · 하프타임 · 종료 줄의 스코어가 이어진다', () => {
    const m = match([
      {
        minute: 60,
        side: 'home',
        scorer: '김공격',
        assist: null,
        scorerId: 'car_1',
        assistId: null,
      },
    ]);
    const script = liveScript(m, name);
    const tally = new LiveScore(m);
    const moments = momentLines(
      { ...moment(), picked: 'round', ok: true },
      [
        {
          minute: 30,
          side: 'home',
          scorer: '김공격',
          assist: null,
          scorerId: 'car_1',
          assistId: null,
        },
      ],
      name,
      tally,
    );
    expect(moments.map((l) => l.kind)).toEqual(['moment', 'goal']);
    expect(moments[1]!.score).toEqual([1, 0]);
    const lines = script.map((l) => tally.line(l));
    expect(lines.find((l) => l.kind === 'goal')!.score).toEqual([2, 0]);
    expect(tally.score).toEqual([2, 0]);
    expect(lines.find((l) => l.kind === 'ft')!.text).toContain('2');
  });

  it('막힌 찬스는 막힘 줄, 막은 위기는 선방 줄을 남긴다', () => {
    const t = new LiveScore(match([]));
    expect(
      momentLines({ ...moment(), picked: 'drive', ok: false }, [], name, t).map((l) => l.kind),
    ).toEqual(['moment', 'save']);
    const crisis = moment({ kind: 'crisis', situation: 'cb-1v1', choices: [] });
    expect(momentLines({ ...crisis, picked: 'auto', ok: true }, [], name, t)[0]!.text).toContain(
      KO.auto,
    );
    expect(t.score).toEqual([0, 0]);
  });
});
