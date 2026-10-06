import { beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import type { GameState } from '@offside/game/types';
import {
  playerNudge,
  takePlayerNudge,
  notePlayerVisit,
  PLAYER_NUDGE_COOLDOWN,
} from './player-nudge.js';

const player = (extra: Partial<GameState> = {}) =>
  ({
    cid: 'c1',
    year: 2027,
    age: 21,
    career: [{}],
    money: 2000,
    contract: null,
    pending: null,
    retired: false,
    ...extra,
  }) as GameState;
let saved = new Map<string, string>();
beforeEach(() => {
  saved = new Map();
  setStorage({
    getItem: (k) => saved.get(k) ?? null,
    setItem: (k, v) => {
      saved.set(k, v);
    },
  });
});
describe('선수 탭 잠재력 안내', () => {
  it('첫 시즌 전·은퇴·이벤트 대기 중에는 평가와 강화 모두 안내하지 않는다', () => {
    for (const s of [
      player({ career: [] }),
      player({ retired: true }),
      player({ pending: { type: 'event' } as GameState['pending'] }),
    ])
      expect(playerNudge(s, true)).toBeNull();
  });
  it('강화 비용을 마련했을 때만 강화 안내를 만들고 실패 가능성을 알린다', () => {
    expect(playerNudge(player({ money: 1999 }))).toBeNull();
    expect(playerNudge(player())?.text).toContain('실패하면');
    expect(playerNudge(player({ age: 30 }))).toBeNull();
    expect(playerNudge(player({ boost: { lv: 0, fails: 0, year: 2027, log: [] } }))).toBeNull();
    expect(playerNudge(player({ boost: { lv: 4, fails: 0, log: [] } }))).toBeNull();
  });
  it('평가를 실제로 열 수 있는 플랫폼에서만 평가 안내를 만든다', () => {
    expect(playerNudge(player({ money: 0 }), true)?.title).toContain('스카우트');
    expect(playerNudge(player({ money: 0 }), false)).toBeNull();
  });
  it('재접속해도 같은 시즌에는 한 번, 다음 시즌도 최소 간격 뒤에 표시한다', () => {
    const n = playerNudge(player())!;
    expect(takePlayerNudge(n, 1000)).toBe(true);
    expect(takePlayerNudge(n, 1000 + PLAYER_NUDGE_COOLDOWN)).toBe(false);
    const next = playerNudge(player({ year: 2028 }))!;
    expect(takePlayerNudge(next, 1001)).toBe(false);
    expect(takePlayerNudge(next, 1000 + PLAYER_NUDGE_COOLDOWN)).toBe(true);
  });
  it('선수 탭에서 이미 본 기회는 안내하지 않고 다른 커리어에는 영향을 주지 않는다', () => {
    const n = playerNudge(player())!;
    notePlayerVisit(n);
    expect(takePlayerNudge(n, PLAYER_NUDGE_COOLDOWN)).toBe(false);
    expect(takePlayerNudge(playerNudge(player({ cid: 'c2' }))!, PLAYER_NUDGE_COOLDOWN)).toBe(true);
  });
  it('저장소가 막히면 반복 안내를 피하고 손상된 기록은 무시한다', () => {
    saved.set('ft_player_nudge', '[null,1,{"key":3,"at":0}]');
    expect(takePlayerNudge(playerNudge(player())!)).toBe(true);
    setStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(takePlayerNudge(playerNudge(player())!)).toBe(false);
  });
});
