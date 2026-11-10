import { describe, expect, it } from 'vitest';
import type { ManagerOrigin } from '@offside/contracts/manager-rules';
import {
  M3_ATTRS,
  M3_BLOCKS,
  M3_LICENSE_CAP,
  M3_MAX_SEASONS,
  acceptOffer,
  answerEvent,
  canRetire,
  closeWindow,
  continueBlock,
  continueReview,
  ending3,
  specialScores3,
  specials3,
  managerResult3,
  migrateManager3Save,
  newManager3,
  playBlock,
  previewManager3,
  restSeason,
  retire,
  spendPoint,
  startSeason,
  stayAtClub,
  targetOptions,
  type M3State,
} from './manager3.js';
import { makeFixtures } from './manager3/match.js';

const origin: ManagerOrigin = {
  pos: 'MF',
  dpos: null,
  seasons: 15,
  apps: 420,
  clubs: 3,
  trophies: 4,
  caps: 30,
  peak: 84,
  legendScore: 600,
  retireAge: 35,
  nation: null,
};

const fresh = (seed = 7) => newManager3({ id: 'mgr_t', careerId: 'c1', seed, origin });

/** 첫 선택지만 고르며 한 단계 진행한다. */
function step(s: M3State, retireAt: number) {
  switch (s.phase) {
    case 'offers':
      if (s.season >= retireAt && canRetire(s)) return retire(s);
      if (s.offers.length) return acceptOffer(s, 0);
      return s.club ? stayAtClub(s) : restSeason(s);
    case 'preseason':
      return startSeason(s, targetOptions(s)[0]!);
    case 'window':
      return closeWindow(s);
    case 'block':
      return playBlock(s);
    case 'blockResult': {
      const ev = s.lastReport?.event;
      if (ev && ev.choice === null) answerEvent(s, 0);
      return continueBlock(s);
    }
    case 'review':
      while (s.points > 0 && M3_ATTRS.some((a) => spendPoint(s, a)));
      if (s.season >= retireAt && canRetire(s)) return retire(s);
      return continueReview(s);
  }
}

function run(s: M3State, retireAt = 6) {
  for (let i = 0; i < 4000 && s.phase !== 'done'; i++) step(s, retireAt);
  return s;
}

describe('감독 커리어 3 일정', () => {
  it('라운드마다 모든 구단이 한 번씩, 홈 · 원정이 고르게 만난다', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const fx = makeFixtures(ids, 38);
    expect(fx).toHaveLength(38);
    for (const round of fx) {
      const seen = round.flatMap((m) => [m.home, m.away]);
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toHaveLength(20);
    }
    const home = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const m of fx.flat()) home[m.home]!++;
    for (const id of ids) expect(home[id]).toBe(19);
  });

  it('홀수 구단이면 라운드마다 한 구단이 쉰다', () => {
    const fx = makeFixtures(['a', 'b', 'c', 'd', 'e'], 10);
    for (const round of fx) expect(round).toHaveLength(2);
  });
});

describe('감독 커리어 3 진행', () => {
  it('시작하면 자격 C 상한 안의 능력치와 제의가 있다', () => {
    const s = fresh();
    expect(s.phase).toBe('offers');
    expect(s.offers.length).toBeGreaterThan(0);
    for (const a of M3_ATTRS) expect(s.attrs[a]).toBeLessThanOrEqual(M3_LICENSE_CAP.C);
    expect(s.license).toBe('C');
  });

  it('미리 보기는 시작 명성 · 성향을 커리어와 같게 보여 준다', () => {
    const p = previewManager3(origin);
    const s = fresh();
    expect(p.rep).toBe(s.rep);
    expect(p.style).toBe(s.plan.mentality);
    for (const a of M3_ATTRS) expect(Math.abs(p.attrs[a] - s.attrs[a])).toBeLessThanOrEqual(5);
  });

  it('한 시즌은 구간 6개, 겨울 이적시장은 구간 3 뒤에 열린다', () => {
    const s = fresh();
    acceptOffer(s, 0);
    startSeason(s, targetOptions(s)[0]!);
    closeWindow(s);
    const phases: string[] = [];
    while (s.phase !== 'review') {
      phases.push(s.phase === 'window' ? `window:${s.block}` : s.phase);
      step(s, 99);
    }
    expect(phases.filter((p) => p === 'block')).toHaveLength(M3_BLOCKS);
    expect(phases).toContain('window:3');
    const played = s.table.find((t) => t.clubId === s.review!.record.clubId) ?? s.history.at(-1)!;
    expect(played.w + played.d + played.l).toBeGreaterThan(0);
  });

  it('이야기에 답하기 전에는 다음으로 넘어가지 않는다', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = fresh(seed);
      acceptOffer(s, 0);
      startSeason(s, targetOptions(s)[0]!);
      closeWindow(s);
      playBlock(s);
      if (s.lastReport?.event) {
        expect(continueBlock(s)).toBe(false);
        expect(answerEvent(s, 0)).toBe(true);
        expect(continueBlock(s)).toBe(true);
        return;
      }
    }
    throw new Error('이야기가 한 번도 나오지 않았다');
  });

  it('5시즌 전에는 은퇴할 수 없고, 끝나면 감독 카드 결과가 나온다', () => {
    const s = fresh();
    expect(retire(s)).toBe(false);
    run(s, 6);
    expect(s.phase).toBe('done');
    expect(s.season).toBeGreaterThanOrEqual(5);
    const r = managerResult3(s)!;
    expect(['S', 'A', 'B', 'C']).toContain(r.grade);
    expect(Object.keys(r.mastery).sort()).toEqual(['3-5-2', '4-3-3', '4-4-2']);
    expect(r.specials.length).toBeLessThanOrEqual(2);
    expect(r.seasons).toBe(s.season);
  });

  it('엔딩은 우승 · 재기 · 승격 · 원클럽 · 저니맨 순으로 먼저 맞는 것이고, 기준은 맡은 시즌 수를 따른다', () => {
    const base = run(fresh(), 10);
    const at = (ids: string[], patch: Partial<M3State> = {}): M3State => ({
      ...base,
      titles: 0,
      promotions: 0,
      comeback: false,
      youthStars: 0,
      ...patch,
      clubs: [...new Set(ids)],
      history: ids.map((id, i) => ({ ...base.history[0]!, n: i + 1, clubId: id })),
    });
    const ten = (last: number) =>
      [...Array(10 - last).keys()].map((i) => `c${i % 3}`).concat(Array(last).fill('z'));
    expect(ending3(at(ten(10), { titles: 2 }), 'A')).toBe('legend');
    expect(ending3(at(ten(10), { titles: 2 }), 'C')).not.toBe('legend');
    expect(ending3(at(ten(4), { titles: 1, sacked: 1, comeback: true }))).toBe('comeback');
    expect(ending3(at(ten(4), { promotions: 1 }))).toBe('promoter');
    // 10시즌이면 마지막 구단 7시즌부터 원클럽, 20시즌이면 14시즌부터.
    expect(ending3(at(ten(7)))).toBe('oneclub');
    expect(ending3(at(ten(6)))).not.toBe('oneclub');
    const twenty = [...Array(7).keys()].map((i) => `c${i}`).concat(Array(13).fill('z'));
    expect(ending3(at(twenty))).not.toBe('oneclub');
    // 10시즌이면 구단 5곳부터 저니맨, 20시즌이면 6곳부터.
    expect(ending3(at(['a', 'b', 'c', 'd', 'e', 'e', 'e', 'f', 'f', 'f'].slice(0, 10)))).toBe(
      'journeyman',
    );
    expect(ending3(at(['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd', 'd', 'd']))).toBe('steady');
    expect(ending3(at([...'aaaabbbbccccddddeeee']))).toBe('steady');
  });

  it('특기는 가장 높은 점수 하나(60점부터)와 70점 넘는 다음 하나이고, 전술은 절반만 써도 만점이다', () => {
    const base = run(fresh(), 10);
    const zero = Object.fromEntries(
      Object.keys(base.blocksBy).map((f) => [f, 0]),
    ) as M3State['blocksBy'];
    const with_ = (
      attrs: Partial<M3State['attrs']>,
      by: Partial<M3State['blocksBy']>,
      youthStars = 0,
    ) => ({
      ...base,
      attrs: { ...base.attrs, atk: 40, tac: 40, def: 40, youth: 40, ...attrs },
      blocksBy: { ...zero, ...by },
      styleUse: { attack: 30, balance: 30, defense: 0, counter: 0 },
      youthStars,
    });
    // 측면 포메이션을 절반 쓰든 전부 쓰든 측면 점수는 같다.
    expect(specialScores3(with_({}, { '4-3-3': 30, '3-5-2': 30 })).wing).toBe(
      specialScores3(with_({}, { '4-3-3': 60 })).wing,
    );
    // 공격 40에 측면 절반: 24 + 40 = 64 → 첫째 특기만.
    expect(specials3(with_({}, { '4-3-3': 30, '5-3-2': 30 }))).toEqual(['wing']);
    // 59점이면 없다.
    expect(specials3(with_({ atk: 31 }, { '4-3-3': 30, '5-3-2': 30 }))).toEqual([]);
    // 둘째 특기는 70점부터: 유스 64(40×0.6+8×5)는 빠지고, 유스 70점이면 들어온다.
    expect(specials3(with_({ atk: 60 }, { '4-3-3': 60 }, 8))).toEqual(['wing']);
    expect(specials3(with_({ atk: 60, youth: 50 }, { '4-3-3': 60 }, 8))).toEqual(['wing', 'youth']);
  });

  it('은퇴를 고르지 않으면 20시즌 · 65세에 끝난다', () => {
    const s = run(fresh(3), 999);
    expect(s.phase).toBe('done');
    expect(s.season <= M3_MAX_SEASONS).toBe(true);
    expect(s.season === M3_MAX_SEASONS || s.age >= 65).toBe(true);
  });

  it('같은 시드 · 같은 선택이면 결과가 같다', () => {
    const a = run(fresh(11));
    const b = run(fresh(11));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = run(fresh(12));
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('세이브를 JSON으로 저장했다 읽어도 같은 결과로 이어진다', () => {
    const a = fresh(21);
    for (let i = 0; i < 40; i++) step(a, 6);
    const b = migrateManager3Save(JSON.parse(JSON.stringify(a)))!;
    expect(b).not.toBeNull();
    run(a);
    run(b);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('모양이 다른 세이브는 읽지 않는다', () => {
    expect(migrateManager3Save(null)).toBeNull();
    expect(migrateManager3Save({ v: 99 })).toBeNull();
    expect(migrateManager3Save({ ...fresh(), squad: 'x' })).toBeNull();
  });

  it('성장 점수는 자격 상한을 넘기지 못한다', () => {
    const s = fresh();
    s.points = 200;
    while (spendPoint(s, 'tac'));
    expect(s.attrs.tac).toBe(M3_LICENSE_CAP.C);
    expect(s.points).toBeGreaterThan(0);
  });
});

describe('감독 커리어 3 선수 이름', () => {
  it('한 선수단 안에서 이름이 겹치지 않는다(유스 입단 · 보충 뒤에도)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = fresh(seed);
      for (let i = 0; i < 400 && s.phase !== 'done' && s.season < 4; i++) {
        step(s, 99);
        const names = s.squad.map((p) => p.name);
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });
});
