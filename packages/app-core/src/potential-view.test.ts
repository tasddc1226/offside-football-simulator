import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from './i18n/core.js';
import { en } from './i18n/en/index';
import fixture from '../../game/src/__fixtures__/save-fw26.json';
import { migrateSave } from '@offside/game/save';
import { getActiveRng } from '@offside/game/rng';
import { retire } from '@offside/game/season';
import { saveKey } from '@offside/game/hof-store';
import type { GameState } from '@offside/game/types';
import { createLegends } from './legend.js';
import { initialAppState } from './state.js';
import { retirementPotential, visibleCareerLog, visibleSeasonNotes } from './potential-view.js';
import { scoutHint } from './scoutHint.js';

function setup() {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  });
  const state = initialAppState();
  const legends = createLegends({
    state,
    rnOf: () => null,
    toast: vi.fn(),
    uploadRetirement: vi.fn(),
    scrollTop: vi.fn(),
  });
  const s = structuredClone(fixture) as unknown as GameState;
  migrateSave(s);
  return { legends, s, state };
}
afterEach(() => vi.unstubAllGlobals());

describe('은퇴 대표 칭호 복원', () => {
  it('재시작한 은퇴 화면은 진행 세이브보다 은퇴 기록에 선택한 칭호를 우선한다', () => {
    const { legends, s } = setup();
    const h = retire(s);
    h.title = 'wall_of_honor';
    saveKey('ft_hof', [h]);
    expect(legends.viewFromGame(s).title).toBe('wall_of_honor');
  });
});

describe('은퇴 잠재력 표시', () => {
  it('기록된 반올림 수치의 등급 경계와 없는 과거 데이터를 구분한다', () => {
    expect([69, 70, 77, 78, 83, 84, 89, 90].map((v) => retirementPotential(v)?.real)).toEqual([
      'D',
      'C',
      'C',
      'B',
      'B',
      'A',
      'A',
      'S',
    ]);
    for (const value of [undefined, null, NaN, Infinity, -1, 151, 89.8])
      expect(retirementPotential(value)).toBeUndefined();
  });

  it('첫 은퇴 화면·저장 후 재열람이 같은 값이며 현재 능력이나 RNG를 바꾸지 않는다', () => {
    const { legends, s } = setup();
    // 89.8은 기존 업로드/로컬 HOF와 같이 90으로 기록된다. 두 화면 모두 기록값을 쓴다.
    s.pot = 90;
    s.bloom = -0.2;
    s.flags.potBonus = 0;
    const h = retire(s);
    const before = structuredClone(s);
    const rng = getActiveRng().getState();
    expect(legends.viewFromGame(s).pot).toEqual({ real: 'S', value: 90 });
    expect(legends.viewFromEntry(JSON.parse(JSON.stringify(h))).pot).toEqual(
      legends.viewFromGame(s).pot,
    );
    expect(s).toEqual(before);
    expect(getActiveRng().getState()).toEqual(rng);
  });

  it('진행 중 세이브에서는 공개하지 않고, 없는 옛 은퇴 값은 최고 OVR로 추정하지 않는다', () => {
    const { legends, s } = setup();
    expect(legends.viewFromGame(s).pot).toBeUndefined();
    const h = retire(s);
    delete h.pot;
    expect(legends.viewFromEntry(h).pot).toBeUndefined();
    expect(legends.viewFromEntry(h).peak).toBe(h.peak);
  });

  it('공개 HOF 상세의 저장된 값도 재열람하고, 옛 서버 응답은 카드가 없다', async () => {
    const { legends, s } = setup();
    const h = retire(s);
    const entry = {
      id: h.id!,
      name: null,
      pos: h.pos,
      number: h.number,
      retireAge: h.age,
      peak: h.peak,
      legendScore: h.score,
      apps: h.apps,
      goals: h.goals,
      assists: h.assists,
      trophies: h.trophies,
      awards: h.awards,
      caps: h.caps,
      ballon: h.ballon,
      lastClub: h.lastClub,
      retiredAt: '2026-10-02',
      hasDetail: false,
      title: null,
      potReal: 84,
    };
    saveKey('ft_hof', []);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ data: { entry, snapshot: null }, meta: { requestId: 'test' } }),
            { status: 200 },
          ),
      ),
    );
    expect(await legends.loadSharedLegend('public-with-pot')).toMatchObject({
      pot: { real: 'A', value: 84 },
      peak: h.peak,
    });
    const old = { ...entry, potReal: undefined };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ data: { entry: old, snapshot: null }, meta: { requestId: 'test' } }),
            { status: 200 },
          ),
      ),
    );
    const result = await legends.loadSharedLegend('public-old-no-pot');
    expect(typeof result).toBe('object');
    if (typeof result === 'object') expect(result.pot).toBeUndefined();
  });
});

describe('옛 로그·시즌 결산의 등급 누출 차단', () => {
  it('기존/신규 로그와 결산을 표시할 때만 가리고 원본·RNG는 보존한다', () => {
    const { s } = setup();
    const notes = ['스카우트 재평가 · 잠재력 S → A', '군 복무 종료'];
    s.log.unshift({
      t: '2029 시즌 종료',
      text: '스카우트 재평가: 잠재력 S → A등급. 성장 곡선이 예상보다 일찍 꺾였다는 평가입니다.',
      kind: 'bad',
    });
    s.log.unshift({ t: '2029 시즌 종료', text: '몸의 한계치가 올라간 느낌입니다.', kind: 'good' });
    const before = structuredClone(s);
    const rng = getActiveRng().getState();
    expect(visibleSeasonNotes(notes)).toEqual(['군 복무 종료']);
    expect(visibleCareerLog(s.log).some((l) => l.text.startsWith('스카우트 재평가'))).toBe(false);
    expect(visibleCareerLog(s.log)[0]?.text).toBe('몸의 한계치가 올라간 느낌입니다.');
    expect(s).toEqual(before);
    expect(notes[0]).toContain('S → A');
    expect(getActiveRng().getState()).toEqual(rng);
    const old = structuredClone(s);
    delete (old as Partial<GameState>).bloom;
    migrateSave(old);
    expect(visibleCareerLog(old.log).some((l) => l.text.startsWith('스카우트 재평가'))).toBe(false);
  });
});

describe('시즌 결산 스카우트 한마디', () => {
  const at = (pot: number, rescout: number) => {
    const s = structuredClone(fixture) as unknown as GameState;
    migrateSave(s);
    s.pot = pot;
    s.flags.potBonus = 0;
    s.flags.rescout = rescout;
    return s;
  };
  it('첫 시즌을 마치기 전에는 보여 주지 않는다', () => {
    const s = at(80, 0);
    s.career = [];
    expect(scoutHint(s, 2026)).toBeNull();
  });
  it('재평가 전에는 상·중·하 3단계, 끝나면 5단계 문장을 고른다', () => {
    const early = [92, 86, 80, 72, 60].map((p) => scoutHint(at(p, 1), 2026));
    expect(early[0]).toBe(scoutHint(at(86, 1), 2026));
    expect(early[2]).toBe(scoutHint(at(72, 1), 2026));
    expect(new Set(early).size).toBe(3);
    const late = [92, 86, 80, 72, 60].map((p) => scoutHint(at(p, 2), 2026));
    expect(new Set(late).size).toBe(5);
  });
  it('같은 시즌은 같은 문장, 다음 시즌은 다른 문장이고 등급 글자를 쓰지 않는다', () => {
    const s = at(80, 2);
    expect(scoutHint(s, 2027)).toBe(scoutHint(s, 2027));
    expect(scoutHint(s, 2028)).not.toBe(scoutHint(s, 2027));
    for (let y = 2026; y < 2040; y++) expect(scoutHint(s, y)).not.toMatch(/[SABCD]/);
  });
  it('영어에서도 같은 번호의 문장이 나오고 한글이 섞이지 않는다', () => {
    const s = at(80, 2);
    const ko = Array.from({ length: 12 }, (_, i) => scoutHint(s, 2026 + i));
    setLocale('en', en);
    try {
      const eng = Array.from({ length: 12 }, (_, i) => scoutHint(s, 2026 + i));
      eng.forEach((t, i) => {
        expect(t).toBeTruthy();
        expect(t).not.toMatch(/[가-힣]/);
        expect(t).not.toBe(ko[i]);
      });
      // 같은 번호끼리 고른다: 한국어가 같은 문장을 되풀이하는 해는 영어도 되풀이한다.
      for (let i = 0; i < 12; i++)
        for (let j = i + 1; j < 12; j++) expect(eng[i] === eng[j]).toBe(ko[i] === ko[j]);
    } finally {
      setLocale('ko');
    }
  });
});
