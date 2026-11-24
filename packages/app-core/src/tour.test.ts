import { describe, expect, it } from 'vitest';
import type { TourMatchView } from '@offside/contracts';
import { tourAssign, tourLocker, tourToggleBench, type TourDraft, type TourPick } from './tour.js';
import { tourGroundNames, tourGroundPlay, tourSegmentLines } from './tourGround.js';

const SEASON = 2;
const pick = (id: string, over: Partial<TourPick> = {}): TourPick => ({
  id,
  peak: 90,
  pos: 'FW',
  dpos: 'ST',
  roles: null,
  type: 'a',
  enhance: 0,
  season: SEASON,
  nation: null,
  mainLeague: 'pl',
  ...over,
});
const draft = (slotIds: (string | null)[], bench: string[] = []): TourDraft => ({
  formation: '4-3-3',
  slotIds: [...slotIds, ...Array<null>(11 - slotIds.length).fill(null)],
  bench,
  tactic: 'possession',
});

describe('원정 투어 편성(라커룸)', () => {
  const picks = [
    pick('now'),
    pick('old', { season: 1, peak: 99 }),
    pick('banned', { mainLeague: 'll' }),
  ];

  it('지난 시즌 카드는 선발로 세울 수 없지만 교체 명단에는 넣을 수 있다', () => {
    const rows = tourLocker(draft([]), picks, [{ kind: 'leagueBan', league: 'll' }], SEASON);
    const by = new Map(rows.map((r) => [r.id, r]));
    expect(by.get('now')).toMatchObject({ blocked: null, playable: true, at: -1, bench: false });
    expect(by.get('old')).toMatchObject({ blocked: 'season', playable: true });
    expect(by.get('banned')).toMatchObject({ blocked: 'rule', playable: false });
    // 세울 수 있는 카드가 앞에 온다(최고 OVR이 더 높은 지난 시즌 카드보다).
    expect(rows[0]!.id).toBe('now');
  });

  it('같은 유형 인원 제한은 그 카드가 서 있는 자리와 고른 자리를 빼고 센다', () => {
    const rule = [{ kind: 'typeCap', max: 1 } as const];
    const two = [pick('a'), pick('b')];
    const d = draft(['a']);
    expect(tourLocker(d, two, rule, SEASON).find((r) => r.id === 'b')!.blocked).toBe('cap');
    // a가 선 자리(0)를 골랐으면 b로 바꿔 세울 수 있다.
    expect(tourLocker(d, two, rule, SEASON, 0).find((r) => r.id === 'b')!.blocked).toBe(null);
    expect(tourLocker(d, two, rule, SEASON).find((r) => r.id === 'a')).toMatchObject({
      blocked: null,
      at: 0,
    });
  });

  it('선발 자리끼리는 맞바꾸고, 교체 명단에서 올린 카드는 명단에서 빠진다', () => {
    const swapped = tourAssign(draft(['a', 'b']), 0, 'b');
    expect(swapped.slotIds.slice(0, 2)).toEqual(['b', 'a']);
    const up = tourAssign(draft(['a'], ['c']), 1, 'c');
    expect(up.slotIds[1]).toBe('c');
    expect(up.bench).toEqual([]);
    expect(tourAssign(draft(['a']), 0, null).slotIds[0]).toBe(null);
  });

  it('교체 명단은 다섯 명까지이고 선발에서 내려온 카드는 자리를 비운다', () => {
    const down = tourToggleBench(draft(['a']), 'a');
    expect(down.slotIds[0]).toBe(null);
    expect(down.bench).toEqual(['a']);
    expect(tourToggleBench(down, 'a').bench).toEqual([]);
    const full = draft([], ['1', '2', '3', '4', '5']);
    expect(tourToggleBench(full, 'x')).toBe(full);
  });
});

describe('원정 투어 그라운드', () => {
  const ev = (minute: number, side: 'home' | 'away', scorerId: string | null) => ({
    minute,
    side,
    scorer: side === 'home' ? '상대 9번' : '내 선수',
    scorerId,
    assist: null,
    assistId: null,
  });
  const match = {
    id: 'tur_1',
    done: 2,
    formation: '4-3-3',
    events: [ev(12, 'away', 'a'), ev(41, 'home', null), ev(52, 'away', 'b')],
  } as unknown as TourMatchView;
  const name = (id: string | null, fallback: string) => (id ? `이름-${id}` : fallback);

  it('구간 줄은 그 구간 분 안에만 있고, 골 줄의 스코어는 앞 구간 골까지 센다', () => {
    const lines = tourSegmentLines(match, { opp: '상대', mine: '우리' }, name);
    expect(lines.every((l) => l.minute > 30 && l.minute <= 60)).toBe(true);
    const goals = lines.filter((l) => l.kind === 'goal');
    expect(goals.map((l) => [l.minute, l.side, l.score])).toEqual([
      [41, 'home', [1, 1]],
      [52, 'away', [1, 2]],
    ]);
    expect(goals[1]!.goal!.scorer).toBe('이름-b');
    // 골마다 바로 앞에 빌드업 줄이 온다.
    for (const g of goals)
      expect(lines[lines.indexOf(g) - 1]).toMatchObject({ kind: 'build', side: g.side });
    // 다시 만들어도 같은 줄이다.
    expect(tourSegmentLines(match, { opp: '상대', mine: '우리' }, name)).toEqual(lines);
  });

  it('말판 이름표는 내 선발(원정 쪽) 11명에 붙는다', () => {
    const g = tourGroundPlay(match, '4-4-2');
    expect(g.players).toHaveLength(22);
    const names = tourGroundNames(['a', null, ...Array<null>(9).fill(null)], (id) => id ?? '용병');
    expect(names.a0).toBe('a');
    expect(names.a1).toBe('용병');
    expect(g.players.filter((p) => p.key in names).every((p) => p.side === 'away')).toBe(true);
  });
});

describe('상대 구단', () => {
  it('구단 id가 모두 게임 구단 데이터에 있고 이름표는 두 팀 22명이다', async () => {
    const { TOUR_CLUBS } = await import('@offside/contracts/squad-tour');
    const { tourOppClub } = await import('./tour.js');
    const { tourGroundNames } = await import('./tourGround.js');
    const names = TOUR_CLUBS.map((club) => tourOppClub({ club })?.name);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(TOUR_CLUBS.length);
    expect(tourOppClub({})).toBeNull();
    const tags = tourGroundNames(Array(11).fill(null), () => 'x', Array(11).fill('y'));
    expect(Object.keys(tags)).toHaveLength(22);
    expect(tags.h10).toBe('y');
  });
});
