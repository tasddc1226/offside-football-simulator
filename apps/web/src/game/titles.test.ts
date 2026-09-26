import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TitleIdSchema } from '@offside/contracts';
import './index.js';
import { newGame } from './engine.js';
import { createRng, rnd, setActiveRng } from './rng.js';
import { legendTitle } from './season.js';
import { TITLES, checkTitles, ensureTitles, mainTitle, titleById } from './titles.js';
import type { GameState } from './types.js';

const fresh = (): GameState => {
  setActiveRng(createRng(7));
  return newGame(
    { name: '홍길동', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
};
const rec = (over: Partial<GameState['career'][number]> = {}): GameState['career'][number] => ({
  year: 2030,
  age: 22,
  club: '테스트 FC',
  league: 'K리그1',
  apps: 30,
  goals: 10,
  assists: 5,
  cs: 0,
  rating: 7,
  rank: 3,
  ovr: 70,
  honors: [],
  pro: true,
  ...over,
});

describe('칭호 레지스트리 (T-10-026)', () => {
  it('id는 겹치지 않고 서버 계약(TitleIdSchema) 모양을 따른다', () => {
    const ids = TITLES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(TitleIdSchema.safeParse(id).success, id).toBe(true);
  });

  it('스토리의 모든 결말 문자열이 칭호로 이어진다', () => {
    const src = readFileSync(new URL('./stories.ts', import.meta.url), 'utf8');
    const endings = new Set<string>();
    for (const m of src.matchAll(/endStory\(s, '([a-z]+)', ([^)]*)\)/g))
      for (const q of m[2]!.matchAll(/'([^']+)'/g))
        if (!/^[A-Z]{2}$/.test(q[1]!)) endings.add(`${m[1]}|${q[1]}`); // 'GK'·'DF' 같은 포지션 비교는 뺀다
    for (const m of src.matchAll(/expireEnding: '([^']+)'/g)) endings.add(`europe|${m[1]}`);
    const s = fresh();
    for (const e of endings) {
      const [key, ending] = e.split('|') as [string, string];
      s.storyLog = [{ year: 2030, key, name: '', ending }];
      expect(
        TITLES.some((d) => d.cat === 'story' && d.earned(s, {})),
        e,
      ).toBe(true);
    }
  });

  it('레전드 등급 이름은 은퇴 칭호와 같은 표를 쓴다', () => {
    expect(legendTitle(900)).toBe('역대 최고의 전설');
    expect(legendTitle(430)).toBe('클럽 레전드');
    expect(legendTitle(10)).toBe('평범한 축구 커리어');
  });
});

describe('칭호 판정', () => {
  it('조건을 채우면 한 번만 얻고, 등급만큼 인기가 오르며, RNG를 쓰지 않는다', () => {
    const s = fresh();
    s.career.push(rec({ goals: 32 }));
    s.fame = 120;
    setActiveRng(createRng(99));
    const got = checkTitles(s).map((d) => d.id);
    const next = rnd();
    setActiveRng(createRng(99));
    expect(next).toBe(rnd());
    expect(got).toEqual(expect.arrayContaining(['debut', 'season30', 'fame50', 'fame100']));
    expect(s.fame).toBe(120 + 1 + 4 + 1 + 2);
    expect(s.titles?.find((e) => e.id === 'season30')?.year).toBe(s.year);
    expect(checkTitles(s)).toEqual([]);
  });

  it('레전드 등급 칭호는 은퇴 점수가 있을 때 해당 구간 하나만 준다', () => {
    const s = fresh();
    expect(checkTitles(s).some((d) => d.cat === 'legend')).toBe(false);
    const got = checkTitles(s, { score: 600 }).filter((d) => d.cat === 'legend');
    expect(got.map((d) => d.id)).toEqual(['lg_world']);
  });

  it('칭호 도입 전 저장은 조용히 채운다(연도 0, 인기 변화 없음)', () => {
    const s = fresh();
    delete s.titles;
    const list = () => (s as { titles?: GameState['titles'] }).titles ?? []; // delete 뒤 좁혀진 타입(never)을 피한다
    s.career.push(rec({ goals: 40 }));
    const fame = s.fame;
    ensureTitles(s);
    expect(list().map((e) => e.id)).toEqual(expect.arrayContaining(['debut', 'season30']));
    expect(list().every((e) => e.year === 0)).toBe(true);
    expect(s.fame).toBe(fame);
    ensureTitles(s); // 이미 있으면 건드리지 않는다
    expect(list().length).toBe(2);
  });

  it('대표 칭호: 직접 고른 것 > 가장 높은 등급 중 최근 것', () => {
    const s = fresh();
    s.titles = [
      { id: 'debut', year: 2027 },
      { id: 'season30', year: 2029 },
      { id: 'goals100', year: 2031 },
    ];
    expect(mainTitle(s)?.id).toBe('season30');
    s.titles.push({ id: 'cs100', year: 2032 });
    expect(mainTitle(s)?.id).toBe('cs100');
    s.titleSel = 'debut';
    expect(mainTitle(s)?.id).toBe('debut');
    s.titleSel = 'ballon'; // 얻지 않은 칭호를 고른 상태면 자동으로
    expect(mainTitle(s)?.id).toBe('cs100');
    expect(titleById('nope')).toBeUndefined();
  });
});
