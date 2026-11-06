import { beforeEach, describe, expect, it } from 'vitest';
import { ManagerResultSchema, type ManagerCareer } from '@offside/contracts';
import { M3_SAVE_KEY } from '@offside/game/manager3';
import { loadKey, setStorage } from '@offside/game/storage';
import {
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
import {
  clearManager3State,
  loadManager3State,
  manager3ServerResult,
  saveManager3State,
} from './manager3.js';

const active: ManagerCareer = {
  id: 'mgr_00000000-0000-4000-8000-000000000001',
  careerId: '00000000-0000-4000-8000-000000000002',
  status: 'active',
  engine: 3,
  seed: 99,
  origin: {
    pos: 'FW',
    dpos: 'ST',
    seasons: 14,
    apps: 380,
    clubs: 2,
    trophies: 3,
    caps: 25,
    peak: 88,
    legendScore: 700,
    retireAge: 34,
    nation: null,
  },
  result: null,
  publicName: null,
  number: null,
  startedAt: '2026-11-06T00:00:00.000Z',
  finishedAt: null,
};

function finish(s: M3State) {
  for (let i = 0; i < 4000 && s.phase !== 'done'; i++) {
    if (s.phase === 'offers') {
      if (canRetire(s) && s.season >= 5) retire(s);
      else if (s.offers.length) acceptOffer(s, 0);
      else if (s.club) stayAtClub(s);
      else restSeason(s);
    } else if (s.phase === 'preseason') startSeason(s, targetOptions(s)[0]!);
    else if (s.phase === 'window') closeWindow(s);
    else if (s.phase === 'block') playBlock(s);
    else if (s.phase === 'blockResult') {
      if (s.lastReport?.event?.choice === null) answerEvent(s, 0);
      continueBlock(s);
    } else if (s.phase === 'review') {
      if (canRetire(s) && s.season >= 5) retire(s);
      else continueReview(s);
    }
  }
}

describe('감독 커리어 3 기기 세이브 · 결과', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
  });
  it('같은 커리어 세이브는 이어 하고, 다른 커리어면 서버 시드로 새로 만든다', () => {
    clearManager3State();
    const a = loadManager3State(active, '홍길동');
    expect(loadKey(M3_SAVE_KEY)).not.toBeNull();
    acceptOffer(a, 0);
    saveManager3State(a);
    expect(loadManager3State(active, null).phase).toBe('preseason');
    const other = loadManager3State(
      { ...active, id: 'mgr_00000000-0000-4000-8000-000000000009' },
      null,
    );
    expect(other.phase).toBe('offers');
  });

  it('서버로 보내는 결과는 계약 스키마를 통과한다', () => {
    clearManager3State();
    const s = loadManager3State(active, null);
    expect(manager3ServerResult(s)).toBeNull();
    finish(s);
    const r = manager3ServerResult(s)!;
    expect(ManagerResultSchema.parse(r)).toEqual(r);
    expect(r.v3).toBeDefined();
  });
});
