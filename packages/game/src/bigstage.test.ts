import { describe, expect, it } from 'vitest';
import './index.js';
import { CLUBS } from './data.js';
import { eventById } from './events-data.js';
import { newGame, newSeason, resolveChoice, rollEvent, turnNo } from './engine.js';
import { natInit, natSeasonEnd, oaFlag } from './national.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-11-543 축구계 큰 무대 이벤트(bigstage-events.ts) — 조건(나이 · 국적 · 대회 해 · 소속 대회)과 월드컵 가는 길 스토리.
const player = (seed: number, o: Partial<GameState> & { leagueId: string }): GameState => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: '홍길동', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
  for (const k of Object.keys(s.sub)) s.sub[k] = 84;
  s.club = { ...CLUBS.find((c) => c.leagueId === o.leagueId)! };
  Object.assign(s, { age: 26, fame: 60, phase: 1, trust: 5, cond: 80 }, o);
  s.season = newSeason(s);
  natInit(s);
  return s;
};
const cond = (id: string, s: GameState) => eventById(id)!.cond(s);

describe('월드컵 가는 길 (T-11-543)', () => {
  it('월드컵 해 전반기에 대표 후보에게만 시작된다', () => {
    const s = player(1, { leagueId: 'pl', year: 2030 });
    s.nat.qual[2030] = true;
    expect(cond('wc-road-1', s)).toBe(true);
    expect(cond('wc-road-1', { ...s, year: 2031 })).toBe(false); // 월드컵 해가 아니다
    s.nat.qual[2030] = false;
    expect(cond('wc-road-1', s)).toBe(false); // 본선 진출 실패
    s.nat.qual[2030] = true;
    s.nat.retired = 2029;
    expect(cond('wc-road-1', s)).toBe(false); // 대표팀 은퇴
  });

  it('세 단계가 이어지고, 결말은 지난여름 월드컵 결과로 정해진다', () => {
    const s = player(2, { leagueId: 'pl', year: 2030 });
    s.nat.qual[2030] = true;
    // 화면 · 시뮬레이터처럼 구간을 마친 뒤(phase가 오른 뒤) 고른다.
    s.phase = 2;
    resolveChoice(s, 'wc-road-1', 1); // 몸을 아낀다(확정)
    expect(s.story.worldcup).toMatchObject({ stage: 1, done: false });
    expect(s.chains.map((c) => c.id)).toContain('wc-road-2');
    expect(rollEvent(s)).toBe('wc-road-2');
    s.phase = 3;
    resolveChoice(s, 'wc-road-2', 1);
    // 시즌 결산(월드컵)은 건너뛰고, 다음 시즌 프리시즌에 8강 기록을 남긴다.
    Object.assign(s, { year: 2031, phase: 0 });
    s.nat.tours.push({
      year: 2030,
      name: '2030 FIFA 월드컵 (스페인·포르투갈·모로코)',
      stage: '8강',
      inSquad: true,
      apps: 5,
      goals: 1,
    });
    expect(turnNo(s)).toBeGreaterThanOrEqual(s.chains.find((c) => c.id === 'wc-road-3')!.at);
    expect(rollEvent(s)).toBe('wc-road-3');
    expect(eventById('wc-road-3')!.text(s)).toContain('8강');
    resolveChoice(s, 'wc-road-3', 1);
    expect(s.story.worldcup).toMatchObject({ done: true, ending: '월드컵의 주인공' });
    expect(s.storyLog.at(-1)).toMatchObject({ key: 'worldcup', name: '월드컵 가는 길' });
  });

  it('명단 발표 직전 다쳐 있으면 2단계가 오지 않고 다음 월드컵을 향해로 끝난다', () => {
    const s = player(3, { leagueId: 'pl', year: 2030 });
    s.nat.qual[2030] = true;
    s.phase = 2;
    resolveChoice(s, 'wc-road-1', 1);
    s.injury = 2;
    rollEvent(s);
    Object.assign(s, { year: 2031, phase: 0, injury: 0 });
    rollEvent(s);
    expect(s.story.worldcup).toMatchObject({ done: true, ending: '다음 월드컵을 향해' });
  });
});

describe('대표팀 대회 전후 (T-11-543)', () => {
  it('와일드카드 답을 시즌 결산의 올림픽 명단이 따른다', () => {
    const s = player(4, { leagueId: 'bl', year: 2028, age: 27, phase: 2 });
    s.nat.qual[2028] = true;
    expect(cond('oa-wildcard', s)).toBe(true);
    expect(cond('oa-wildcard', { ...s, age: 23 })).toBe(false); // U-23은 차출 협상 이벤트(oly-release) 몫
    s.flags[oaFlag('olympic', 2028)] = true;
    expect(cond('oa-wildcard', s)).toBe(false); // 한 번만 묻는다
    const go = natSeasonEnd(s).tours.find((t) => t.name.includes('올림픽 남자축구'))!;
    expect(go).toMatchObject({ inSquad: true });

    const t = player(5, { leagueId: 'bl', year: 2028, age: 27, phase: 2 });
    t.nat.qual[2028] = true;
    t.flags[oaFlag('olympic', 2028)] = false;
    const no = natSeasonEnd(t).tours.find((x) => x.name.includes('올림픽 남자축구'))!;
    expect(no).toMatchObject({ inSquad: false });
  });

  it('아시안게임 와일드카드는 아시아 연맹 국적만, 병역 문장은 대한민국 미필자만', () => {
    const kr = player(6, { leagueId: 'k1', year: 2030, age: 25, phase: 2 });
    expect(cond('oa-wildcard', kr)).toBe(true);
    expect(eventById('oa-wildcard')!.text(kr)).toContain('병역 특례');
    const br = player(7, { leagueId: 'k1', year: 2030, age: 25, phase: 2, nation: 'BR' });
    expect(cond('oa-wildcard', br)).toBe(false);
    const jp = player(8, { leagueId: 'j1', year: 2030, age: 25, phase: 2, nation: 'JP' });
    expect(cond('oa-wildcard', jp)).toBe(true);
    expect(eventById('oa-wildcard')!.text(jp)).not.toContain('병역');
  });

  it('대륙컵 조기 소집은 그 연맹의 대륙컵 해에만 온다', () => {
    const eng = player(9, { leagueId: 'pl', year: 2028, phase: 2, nation: 'GB-ENG' });
    eng.nat.caps = 10;
    expect(cond('cont-cup-eve', eng)).toBe(true);
    expect(eventById('cont-cup-eve')!.text(eng)).toContain('UEFA 유로');
    expect(cond('cont-cup-eve', { ...eng, year: 2027 })).toBe(false);
    const kr = player(10, { leagueId: 'pl', year: 2027, phase: 2 });
    kr.nat.caps = 10;
    expect(cond('cont-cup-eve', kr)).toBe(true);
    expect(eventById('cont-cup-eve')!.text(kr)).toContain('AFC 아시안컵');
  });

  it('대표팀 우승 뒤 프리시즌에 퍼레이드, 대회를 뛴 여름 뒤에 휴가 장면이 온다', () => {
    const s = player(11, { leagueId: 'pl', year: 2029, phase: 0, nation: 'AR' });
    s.nat.tours.push({
      year: 2028,
      name: '2028 코파 아메리카',
      stage: '우승',
      inSquad: true,
      apps: 6,
      goals: 2,
    });
    expect(cond('nat-parade', s)).toBe(true);
    expect(cond('post-tour-rest', s)).toBe(true);
    resolveChoice(s, 'nat-parade', 1);
    expect(cond('nat-parade', s)).toBe(false);
  });

  it('A매치를 다녀온 구간, 대표팀과 리그의 대륙이 다르면 장거리 비행 장면이 온다', () => {
    const s = player(12, { leagueId: 'pl', year: 2029 });
    s.season.capsStart = 3;
    s.nat.caps = 5;
    expect(cond('intl-flight', s)).toBe(true); // 대한민국 · 프리미어리그
    const k = player(13, { leagueId: 'k1', year: 2029 });
    k.season.capsStart = 3;
    k.nat.caps = 5;
    expect(cond('intl-flight', k)).toBe(false); // 대한민국 · K리그1
  });
});

describe('구단 무대 (T-11-543)', () => {
  it('챔피언스리그 첫 경기 앤섬은 한 번, 대륙 대회 원정은 리베르타도레스 · 아시아 · 북중미에서', () => {
    const s = player(14, { leagueId: 'pl', year: 2029 });
    s.season.comps = [
      {
        type: 'cont',
        key: 'UCL',
        name: 'UEFA 챔피언스리그',
        alive: true,
        stage: '리그 페이즈',
        apps: 0,
        g: 0,
        a: 0,
      },
    ];
    expect(cond('ucl-anthem', s)).toBe(true);
    expect(cond('cont-away', s)).toBe(false);
    resolveChoice(s, 'ucl-anthem', 1);
    expect(cond('ucl-anthem', s)).toBe(false);
    const b = player(15, { leagueId: 'bra', year: 2029, nation: 'BR' });
    b.season.comps = [
      {
        type: 'cont',
        key: 'LIB',
        name: '코파 리베르타도레스',
        alive: true,
        stage: '',
        apps: 0,
        g: 0,
        a: 0,
      },
    ];
    expect(cond('cont-away', b)).toBe(true);
    expect(eventById('cont-away')!.text(b)).toContain('3,600m');
  });

  it('대륙 대회 결승에서 지면 후반기에 준우승 메달 장면이 온다', () => {
    const s = player(16, { leagueId: 'pl', year: 2029, phase: 2 });
    s.season.comps = [
      {
        type: 'cont',
        key: 'UCL',
        name: 'UEFA 챔피언스리그',
        alive: false,
        stage: '준우승',
        apps: 9,
        g: 3,
        a: 1,
      },
    ];
    expect(cond('cont-final-medal', s)).toBe(true);
    s.season.comps[0]!.stage = '우승';
    expect(cond('cont-final-medal', s)).toBe(false);
  });

  it('발롱도르 시상식은 지난 시즌 30인 후보에게, 순위를 문구에 넣는다', () => {
    const s = player(17, { leagueId: 'pl', year: 2029 });
    expect(cond('ballon-gala', s)).toBe(false);
    s.ballon = [{ year: 2028, rank: 7 }];
    expect(cond('ballon-gala', s)).toBe(true);
    expect(eventById('ballon-gala')!.text(s)).toContain('7위');
  });

  it('기념 경기는 한 구단에서 7시즌 넘게 뛴 31세 이상 선수에게 온다', () => {
    const s = player(18, { leagueId: 'k1', year: 2035, phase: 0, age: 32 });
    const row = {
      age: 0,
      club: s.club.name,
      clubId: s.club.id,
      league: 'K리그1',
      apps: 30,
      goals: 5,
      assists: 2,
      cs: 0,
      rating: 7,
      rank: 3,
      ovr: 80,
      honors: [],
    };
    s.career = Array.from({ length: 7 }, (_, i) => ({ ...row, year: 2028 + i }));
    expect(cond('testimonial', s)).toBe(true);
    s.career[3] = { ...s.career[3]!, loan: true };
    expect(cond('testimonial', s)).toBe(false);
  });
});
