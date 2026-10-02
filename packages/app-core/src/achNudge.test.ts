import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubAchievementsResponse } from '@offside/contracts';
import { isAchDirty, markAchDirty, touchesAchievements } from './achDirty.js';
import { absorbAch, achieveView, createAchNudge, type AchSeen } from './achNudge.js';
import { initialAppState } from './state.js';

function fakeStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}

/** 업적 응답 — pts: 업적 id별 지금 점수. */
function resp(pts: Record<string, number>, season = 1): ClubAchievementsResponse {
  const items = Object.entries(pts).map(([id, points]) => ({
    id,
    label: `${id} 업적`,
    done: points > 0,
    points,
    worth: 10,
  }));
  return {
    season,
    seasons: [],
    players: 1,
    groups: [{ id: 'g', category: 'player', stage: '0단계', title: 'g', items }],
    score: Object.values(pts).reduce((s, p) => s + p, 0),
    rank: null,
    ranked: 0,
  };
}
const seen = (pts: Record<string, number>, season = 1, unseen: string[] = []): AchSeen => ({
  season,
  pts,
  score: Object.values(pts).reduce((s, p) => s + p, 0),
  unseen,
});

describe('absorbAch', () => {
  it('같은 시즌이면 점수가 오른 업적만 새 업적이다(단계 업적은 오른 만큼)', () => {
    const { seen: s, nudge } = absorbAch(seen({ a: 10, b: 20 }), resp({ a: 10, b: 60, c: 10 }));
    expect(nudge?.fresh).toEqual([
      { id: 'b', label: 'b 업적', gained: 40 },
      { id: 'c', label: 'c 업적', gained: 10 },
    ]);
    expect(s.unseen).toEqual(['b', 'c']);
    expect(nudge?.from).toBeNull();
  });

  it('등급 경계를 넘으면 이전 등급을 함께 준다', () => {
    const { nudge } = absorbAch(seen({ a: 190 }), resp({ a: 190, b: 20 }));
    expect(nudge?.from?.id).toBe('rookie');
    expect(nudge?.grade.id).toBe('bronze');
    expect(nudge?.next?.id).toBe('silver');
  });

  it('바뀐 게 없으면 알리지 않고 보지 않은 업적은 남는다', () => {
    const { seen: s, nudge } = absorbAch(seen({ a: 10 }, 1, ['a']), resp({ a: 10 }));
    expect(nudge).toBeNull();
    expect(s.unseen).toEqual(['a']);
  });

  it('새 시즌은 처음부터 — 점수가 있는 업적이 모두 새 업적이다', () => {
    const { seen: s, nudge } = absorbAch(seen({ a: 500 }, 0, ['a']), resp({ a: 10 }, 1));
    expect(nudge?.fresh.map((f) => f.id)).toEqual(['a']);
    expect(s).toMatchObject({ season: 1, unseen: ['a'] });
  });

  it('본 기록이 없을 때 많이 쌓여 있으면 기준만 잡는다', () => {
    expect(absorbAch(null, resp({ a: 10, b: 10, c: 10, d: 10 })).nudge).toBeNull();
    expect(absorbAch(null, resp({ a: 10 })).nudge?.fresh).toHaveLength(1);
  });
});

describe('achieveView', () => {
  it('등급이 오르면 승급 제목, 아니면 개수 — 4개 넘으면 외 N개', () => {
    const up = absorbAch(seen({ a: 190 }), resp({ a: 190, b: 20 })).nudge!;
    expect(achieveView(up)).toMatchObject({
      title: '브론즈 등급이 됐어요',
      from: { id: 'rookie' },
      gained: 20,
      score: 210,
      next: '실버까지 290점',
    });
    const many = absorbAch(seen({}), resp({ a: 10, b: 10, c: 10, d: 10, e: 10 })).nudge!;
    const v = achieveView(many);
    expect(v.title).toBe('업적 5개를 달성했어요');
    expect(v.items).toHaveLength(4);
    expect(v.more).toBe(1);
  });
});

describe('touchesAchievements', () => {
  it('업적이 바뀔 수 있는 쓰기만', () => {
    expect(touchesAchievements('/v1/owner-team')).toBe(true);
    expect(touchesAchievements('/v1/owner-team/matches')).toBe(true);
    expect(touchesAchievements('/v1/teams/abc/like')).toBe(true);
    expect(touchesAchievements('/v1/profile/nickname')).toBe(true);
    expect(touchesAchievements('/v1/teams/abc/views')).toBe(false);
    expect(touchesAchievements('/v1/board/posts')).toBe(false);
  });
});

describe('createAchNudge', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = fakeStorage();
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup(r: ClubAchievementsResponse | 'forbidden', open = false) {
    const state = initialAppState();
    const shown: unknown[] = [];
    const fetch = vi.fn(async () =>
      r === 'forbidden'
        ? ({ ok: false, error: { code: 'FORBIDDEN', message: '', retryable: false } } as const)
        : ({ ok: true, data: r } as const),
    );
    const nudge = createAchNudge({
      state,
      fetch,
      sheetOpen: () => open,
      showSheet: (v) => void shown.push(v),
      closeSheet: () => {},
      openAchievements: () => {},
    });
    return { state, shown, fetch, nudge };
  }

  it('쓰기가 없었으면 묻지 않는다', async () => {
    const { fetch, nudge } = setup(resp({ a: 10 }));
    await nudge.check();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('쓰기 뒤 새 업적을 시트로 알리고 점을 단다 — 업적 탭을 열면 NEW를 주고 점을 지운다', async () => {
    store.set('ft_ach_seen', JSON.stringify(seen({ a: 10 })));
    const { state, shown, nudge } = setup(resp({ a: 10, b: 10 }));
    markAchDirty();
    await nudge.check();
    expect(shown).toHaveLength(1);
    expect(state.achNew).toBe(1);
    expect(isAchDirty()).toBe(false);
    expect([...nudge.viewed(resp({ a: 10, b: 10 }))]).toEqual(['b']);
    expect(state.achNew).toBe(0);
  });

  it('은퇴가 아직 올라가지 않았거나 시트가 떠 있으면 미룬다', async () => {
    markAchDirty();
    store.set('ft_outbox', JSON.stringify([{ kind: 'retirement', careerId: 'x' }]));
    const a = setup(resp({ a: 10 }));
    await a.nudge.check();
    expect(a.fetch).not.toHaveBeenCalled();
    store.delete('ft_outbox');
    const b = setup(resp({ a: 10 }), true);
    await b.nudge.check();
    expect(b.fetch).not.toHaveBeenCalled();
    expect(isAchDirty()).toBe(true);
  });

  it('구단주가 아니면(403) 표시만 지운다', async () => {
    markAchDirty();
    const { shown, nudge } = setup('forbidden');
    await nudge.check();
    expect(shown).toHaveLength(0);
    expect(isAchDirty()).toBe(false);
  });

  it('지난 시즌 화면은 본 기록을 건드리지 않는다', () => {
    store.set('ft_ach_seen', JSON.stringify(seen({ a: 10 }, 1, ['a'])));
    const { state, nudge } = setup(resp({}));
    nudge.restore();
    expect(state.achNew).toBe(1);
    expect(nudge.viewed(resp({ z: 90 }, 0)).size).toBe(0);
    expect(state.achNew).toBe(1);
  });
});
