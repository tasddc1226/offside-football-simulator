// T-11-648 감독 키우기 이야기 50종: 문구 키가 다 있고, 실제 커리어에서 골고루 나오며, 화면 문장이 비지 않는다.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ManagerCareer } from '@offside/contracts';
import { MANAGER_EVENTS } from '@offside/game/manager';
import {
  M3_STORIES,
  acceptOffer,
  answerEvent,
  canRetire,
  closeWindow,
  continueBlock,
  continueReview,
  playBlock,
  restSeason,
  retire,
  startSeason,
  stayAtClub,
  targetOptions,
  type M3State,
} from '@offside/game/manager3';
import { setStorage } from '@offside/game/storage';
import { clearManager3State, loadManager3State } from './manager3.js';
import { eventView } from './manager3View.js';
import { manager3Text as T } from './i18n/ko/manager3.js';

const PLAYER_STORIES = ['playtime', 'renewal', 'bigbid', 'fight'];

const career = (seed: number): ManagerCareer => ({
  id: `mgr_00000000-0000-4000-8000-${String(seed).padStart(12, '0')}`,
  careerId: '00000000-0000-4000-8000-000000000002',
  status: 'active',
  engine: 3,
  seed,
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
});

/** 끝까지 돌리며 나온 이야기마다 화면 문장을 확인한다. 선택은 시드에 따라 돌린다. */
function play(s: M3State, seen: Map<string, number>, problems: string[]) {
  let pick = 0;
  for (let i = 0; i < 6000 && s.phase !== 'done'; i++) {
    if (s.phase === 'offers') {
      if (canRetire(s) && s.season >= 10) retire(s);
      else if (s.offers.length) acceptOffer(s, 0);
      else if (s.club) stayAtClub(s);
      else restSeason(s);
    } else if (s.phase === 'preseason') startSeason(s, targetOptions(s)[0]!);
    else if (s.phase === 'window') closeWindow(s);
    else if (s.phase === 'block') playBlock(s);
    else if (s.phase === 'blockResult') {
      const ev = s.lastReport?.event;
      if (ev && ev.choice === null) {
        const before = eventView(s, ev);
        answerEvent(s, pick++ % before.choices.length);
        const after = eventView(s, s.lastReport!.event!);
        const key = `${ev.kind}:${ev.id}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        if (!before.title || !before.body || before.choices.some((c) => !c) || !after.result)
          problems.push(key);
      }
      continueBlock(s);
    } else if (s.phase === 'review') {
      if (canRetire(s) && s.season >= 10) retire(s);
      else continueReview(s);
    }
  }
}

describe('감독 키우기 이야기 (T-11-648)', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
  });

  it('이야기는 선수 4 · 이야기 표 20 · 감독 26, 모두 50종이고 id가 겹치지 않는다', () => {
    const ids = [
      ...PLAYER_STORIES,
      ...M3_STORIES.map((d) => d.id),
      ...MANAGER_EVENTS.map((e) => e.id),
    ];
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
  });

  it('이야기 표마다 제목 · 본문 · 선택지 · 결과 문구가 있다', () => {
    const tx = T as unknown as Record<string, unknown>;
    for (const d of M3_STORIES) {
      const keys = [
        't',
        'b',
        ...d.choices.flatMap((c, i) => [
          `c${i}`,
          ...(c.p === undefined ? [`r${i}`] : [`r${i}_ok`, `r${i}_fail`]),
        ]),
      ];
      for (const k of keys) expect(tx[`st_${d.id}_${k}`], `st_${d.id}_${k}`).toBeTruthy();
      expect(d.choices.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('여러 커리어를 돌리면 이야기 표가 골고루 나오고 화면 문장이 비지 않는다', () => {
    const seen = new Map<string, number>();
    const problems: string[] = [];
    for (let seed = 1; seed <= 24; seed++) {
      clearManager3State();
      play(loadManager3State(career(seed), '테스트'), seen, problems);
    }
    expect(problems).toEqual([]);
    const stories = M3_STORIES.filter((d) => seen.has(`story:${d.id}`));
    expect(stories.length).toBeGreaterThanOrEqual(18);
  });
});
