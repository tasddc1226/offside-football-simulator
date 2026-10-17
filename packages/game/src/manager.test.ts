import { describe, expect, it } from 'vitest';
import { ManagerResultSchema } from '@offside/contracts';
import {
  MANAGER_EVENTS,
  acceptOffer,
  answerEvent,
  closeEvents,
  continueAfterResult,
  currentEvent,
  managerChoiceOdds,
  managerEventText,
  managerMatchday,
  managerResult,
  managerStart,
  migrateManagerSave,
  newManagerCareer,
  pickTransfer,
  restSeason,
  setupSeason,
  targetOptions,
  type ManagerState,
} from './manager.js';
import { gManagerText } from './i18n/ko/gManager.js';

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

const start = (seed = 7) =>
  newManagerCareer({ id: 'mgr_t', careerId: 'c1', seed, origin: ORIGIN, name: '홍길동' });

/** 늘 첫 선택지를 고르며 끝까지 돈다. */
function playThrough(s: ManagerState) {
  for (let i = 0; i < 400 && s.phase !== 'done'; i++) {
    if (s.phase === 'offers') {
      if (s.offers.length) acceptOffer(s, 0);
      else restSeason(s);
    } else if (s.phase === 'setup')
      setupSeason(s, { formation: '4-4-2', style: 'balance', target: targetOptions(s)[0]! });
    else if (s.phase === 'transfer') pickTransfer(s, 0);
    else if (s.phase === 'event') {
      if (currentEvent(s)) answerEvent(s, 0);
      else closeEvents(s);
    } else continueAfterResult(s);
  }
  return s;
}

describe('감독 커리어', () => {
  it('선수 시절 경험이 시작값이 된다(명성은 OVR · 레전드 점수로만)', () => {
    const a = managerStart(ORIGIN);
    const b = managerStart({ ...ORIGIN, seasons: 4, apps: 60, clubs: 1, trophies: 0 });
    expect(a.control).toBeGreaterThan(b.control);
    expect(a.adapt).toBeGreaterThan(b.adapt);
    expect(a.trust).toBeGreaterThan(b.trust);
    expect(a.fame).toBe(b.fame);
    expect(managerStart({ ...ORIGIN, pos: 'FW', dpos: null }).style).toBe('attack');
    expect(managerStart({ ...ORIGIN, pos: 'DF', dpos: null }).style).toBe('defense');
  });

  it('옛 기록(모르는 값 0 · null)도 시작할 수 있다', () => {
    const s = newManagerCareer({
      id: 'mgr_o',
      careerId: 'c0',
      seed: 1,
      origin: {
        ...ORIGIN,
        seasons: 0,
        apps: 0,
        clubs: 0,
        trophies: 0,
        caps: 0,
        peak: 0,
        legendScore: 0,
        retireAge: null,
        dpos: null,
      },
    });
    expect(s.offers.length).toBeGreaterThan(0);
    expect(playThrough(s).phase).toBe('done');
  });

  it('8~10시즌을 끝까지 돌면 서버가 받는 결과가 나온다', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = playThrough(start(seed));
      expect(s.phase).toBe('done');
      expect(s.season).toBeGreaterThanOrEqual(8);
      expect(s.season).toBeLessThanOrEqual(10);
      expect(ManagerResultSchema.safeParse(managerResult(s)).success).toBe(true);
    }
  });

  it('같은 시드 · 같은 선택이면 같은 결과다', () => {
    expect(managerResult(playThrough(start(42)))).toEqual(managerResult(playThrough(start(42))));
  });

  it('한 포메이션만 쓰면 그 포메이션 숙련이 오른다', () => {
    const res = managerResult(playThrough(start(9)))!;
    expect(['A', 'S']).toContain(res.mastery['4-4-2']);
    expect(res.mastery['3-5-2']).not.toBe('S');
  });

  it('이사회 최소 목표보다 낮은 목표는 고를 수 없다', () => {
    const s = start();
    acceptOffer(s, 0);
    const opts = targetOptions(s);
    expect(setupSeason(s, { formation: '4-3-3', style: 'attack', target: 'title' })).toBe(
      opts.includes('title'),
    );
  });

  it('이벤트마다 제목 · 본문 · 선택지 · 결과 문구가 있다', () => {
    const ko = gManagerText as unknown as Record<string, unknown>;
    for (const e of MANAGER_EVENTS) {
      const t = managerEventText(e.id);
      expect(t.t && t.b).toBeTruthy();
      expect(t.choices.every(Boolean)).toBe(true);
      e.choices.forEach((c, i) => {
        expect(ko[`ev_${e.id}_r${i}`]).toBeTruthy();
        if (c.fail) expect(ko[`ev_${e.id}_f${i}`]).toBeTruthy();
      });
    }
  });

  it('세이브를 다시 읽는다(버전이 다르면 새로 시작)', () => {
    const s = start();
    expect(migrateManagerSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(migrateManagerSave({ ...s, v: 2 })).toBeNull();
    expect(migrateManagerSave(null)).toBeNull();
  });

  it('시즌 경기 목록은 결산 승무패와 같고, 다시 만들어도 같으며 커리어 난수를 쓰지 않는다', () => {
    const s = playThrough(start(11));
    const played = s.history.filter((h) => h.clubId);
    expect(played.length).toBeGreaterThan(0);
    for (const h of played) {
      const rng = JSON.stringify(s.rng);
      const m = managerMatchday(s.id, h);
      expect(JSON.stringify(s.rng)).toBe(rng);
      expect(m).toEqual(managerMatchday(s.id, h));
      expect(m.length).toBe(h.w + h.d + h.l);
      expect(m.filter((x) => x.res === 'W').length).toBe(h.w);
      expect(m.filter((x) => x.res === 'D').length).toBe(h.d);
      for (const x of m) {
        expect(x.opp).not.toBe(h.club);
        expect(Math.sign(x.gf - x.ga)).toBe(x.res === 'W' ? 1 : x.res === 'L' ? -1 : 0);
      }
    }
    expect(managerMatchday(s.id, { ...played[0]!, clubId: null })).toEqual([]);
  });

  it('치른 시즌은 시작 · 끝 상태를 남긴다(결산 변화 칩)', () => {
    const s = playThrough(start(5));
    for (const h of s.history.filter((x) => x.clubId)) {
      expect(h.start).toBeDefined();
      expect(h.end).toBeDefined();
      expect(h.end!.fame).toBeGreaterThanOrEqual(0);
    }
    expect(s.seasonStart).toBeUndefined();
  });

  it('T-11-329 선택지 확률을 보여 주고, 실패할 수 있는 선택만 성공 여부를 남긴다', () => {
    for (const e of MANAGER_EVENTS) {
      expect(managerChoiceOdds(e.id)).toHaveLength(managerEventText(e.id).choices.length);
    }
    const risky = MANAGER_EVENTS.find((e) => e.choices.some((c) => c.p !== undefined))!;
    const ri = risky.choices.findIndex((c) => c.p !== undefined);
    expect(managerChoiceOdds(risky.id)[ri]).toBe(risky.choices[ri]!.p);
    const sure = risky.choices.findIndex((c) => c.p === undefined);
    expect(managerChoiceOdds(risky.id)[sure]).toBeNull();
    const oks = new Set<boolean | undefined>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = start(seed);
      s.phase = 'event';
      s.events = [{ id: risky.id, choice: null, result: null }];
      answerEvent(s, ri);
      oks.add(s.events[0]!.ok);
      const t = start(seed);
      t.phase = 'event';
      t.events = [{ id: risky.id, choice: null, result: null }];
      answerEvent(t, sure);
      expect(t.events[0]!.ok).toBeUndefined();
    }
    expect(oks).toEqual(new Set([true, false]));
  });
});
