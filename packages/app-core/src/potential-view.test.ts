import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from './i18n/core.js';
import { en } from './i18n/en/index';
import fixture from '../../game/src/__fixtures__/save-fw26.json';
import { migrateSave } from '@offside/game/save';
import { getActiveRng } from '@offside/game/rng';
import { retire } from '@offside/game/season';
import { saveKey } from '@offside/game/storage';
import type { GameState } from '@offside/game/types';
import { createLegends } from './legend.js';
import { initialAppState } from './state.js';
import { potentialFlowLines, potentialSeedLines } from './potential-flow.js';
import { retirementPotential, visibleCareerLog, visibleSeasonNotes } from './potential-view.js';
import { scoutHint, seasonTrend, VETERAN_HINT_AGE } from './scoutHint.js';
import { appScoutText } from './i18n/ko/appScout.js';

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

  it('T-11-141 은퇴 뒤에만 잠재력이 바뀐 과정과 시드를 보여 준다(옛 세이브는 시작 값 없이)', () => {
    const { legends, s } = setup();
    expect(legends.viewFromGame(s).flow).toBeUndefined();
    s.pot = 80;
    s.bloom = 1;
    s.flags.potBonus = 2;
    s.origin = { seed: 1234, pot: 77 };
    retire(s);
    const v = legends.viewFromGame(s);
    expect(v.flow).toEqual({
      start: { grade: 'C', value: 77 },
      drift: 4,
      boost: 2,
      boostLv: 0,
      seed: 1234,
      bal: 0,
    });
    // T-11-408 강화 단계가 없으면 2는 모두 이벤트 몫이다.
    expect(potentialFlowLines(v.flow!, v.pot!)).toEqual([
      '처음 실제 잠재력 C (77)',
      '25세까지 성장기 변동(무작위) +4',
      '트레이너 · 스토리 이벤트 +2',
      '은퇴 시 실제 잠재력 B (83)',
    ]);
    expect(potentialSeedLines(v.flow!)[0]).toContain('1234');
    // 강화 4단계 + 23세 이하 트레이너 +2 = 6이면 두 줄로 나눈다.
    expect(potentialFlowLines({ ...v.flow!, boost: 6, boostLv: 4 }, v.pot!)).toContain(
      '잠재력 강화 +4',
    );
    expect(potentialFlowLines({ ...v.flow!, boost: 6, boostLv: 4 }, v.pot!)).toContain(
      '트레이너 · 스토리 이벤트 +2',
    );
    delete s.origin;
    const old = legends.viewFromGame(s).flow!;
    expect(old).toEqual({ boost: 2, boostLv: 0, bal: 0 });
    // 나눈 값이 없는 옛 은퇴 기록은 합만 보인다.
    expect(potentialFlowLines({ boost: 2, bal: 0 }, v.pot!)).toEqual([
      '잠재력 강화 · 이벤트 +2',
      '은퇴 시 실제 잠재력 B (83)',
    ]);
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
  // T-11-264 베테랑은 잠재력 대신 지난 시즌과 견준 흐름을 말한다.
  it('31세부터는 잠재력 풀 대신 지난 시즌 대비 상승·유지·하락 문장을 고른다', () => {
    const rec = (year: number, rating: number, apps = 30, mil?: boolean) =>
      ({
        year,
        age: 20,
        club: 'c',
        league: 'l',
        apps,
        goals: 0,
        assists: 0,
        cs: 0,
        rating,
        rank: 5,
        ovr: 70,
        honors: [],
        pro: true,
        ...(mil ? { mil: true } : {}),
      }) as GameState['career'][number];
    const vet = (ratings: number[]) => {
      const s = at(80, 2);
      s.age = VETERAN_HINT_AGE;
      s.career = ratings.map((r, i) => rec(2030 + i, r));
      return s;
    };
    const pool = (name: string) =>
      Array.from({ length: 3 }, (_, i) => appScoutText.hint({ pool: name, i }));
    const pools = { up: pool('vetUp'), steady: pool('vetSteady'), down: pool('vetDown') };
    expect(pools.up).toContain(scoutHint(vet([7.0, 7.3]), 2031));
    expect(pools.steady).toContain(scoutHint(vet([7.0, 7.1]), 2031));
    expect(pools.down).toContain(scoutHint(vet([7.0, 6.7]), 2031));
    // 첫 시즌·비교 불가는 유지로, 30세까지는 여전히 잠재력 문장이다.
    expect(pools.steady).toContain(scoutHint(vet([7.3]), 2030));
    const young = vet([7.0, 7.3]);
    young.age = VETERAN_HINT_AGE - 1;
    expect([...pools.up, ...pools.steady, ...pools.down]).not.toContain(scoutHint(young, 2031));
    // 군 복무 시즌은 건너뛰고 그 전 시즌과 견준다. 출전이 크게 줄면 평점이 비슷해도 하락이다.
    expect(seasonTrend(rec(2033, 7.3), rec(2031, 7.0))).toBe('up');
    expect(seasonTrend(rec(2032, 7.0, 8), rec(2031, 7.0, 30))).toBe('down');
    expect(seasonTrend(rec(2032, 7.0, 0), rec(2031, 7.0))).toBeNull();
    expect(seasonTrend(rec(2032, 7.0), undefined)).toBeNull();
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
