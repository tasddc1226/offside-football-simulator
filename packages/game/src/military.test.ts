import { describe, expect, it } from 'vitest';
import './index.js';
import { CLUBS } from './data.js';
import { newGame, newSeason } from './engine.js';
import {
  grantSportsService,
  enlistSangmu,
  milDone,
  milDue,
  milCanApply,
  milOptions,
  milEnlistMarket,
  milSeasonEnd,
  milStatusText,
} from './military.js';
import { natSeasonEnd } from './national.js';
import { acceptOption, market } from './season.js';
import { createRng, setActiveRng } from './rng.js';
import { loadSave } from './save.js';
import { checkTitles } from './titles.js';

const player = (seed = 1, year = 2028, skill = 88, age = 22) => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: 'TEST', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
  for (const k of Object.keys(s.sub)) s.sub[k] = skill;
  Object.assign(s, { year, age, fame: 60, leagueId: 'k1' });
  s.club = { ...CLUBS.find((c) => c.leagueId === 'k1')! };
  s.contract = { years: 3, salary: 10000 };
  s.season = newSeason(s);
  s.nat.qual[year] = true;
  return s;
};

describe('T-11-062 체육요원 특례', () => {
  it.each([
    ['ag', '우승', true],
    ['ag', '준우승', false],
    ['ag', '동메달', false],
    ['olympic', '금메달', true],
    ['olympic', '은메달', true],
    ['olympic', '동메달', true],
    ['olympic', '4위', false],
    ['olympic', '본선 진출 실패', false],
    ['asian', '우승', false],
    ['wc', '우승', false],
    ['euro', '우승', false],
  ])('%s %s 특례 대상=%s', (key, stage, eligible) => {
    const s = player();
    const before = structuredClone(s.mil);
    expect(grantSportsService(s, key, stage, true)).toBe(eligible);
    if (eligible) {
      expect(s.mil.sportsService).toEqual({ monthsLeft: 34, lastYear: 2028 });
      expect(s.mil.served).toBe(false);
    } else expect(s.mil).toEqual(before);
  });

  it('명단 외 선수와 외국 선수는 메달을 따도 상태를 바꾸지 않는다', () => {
    for (const nation of [undefined, 'JP', 'BR']) {
      for (const inSquad of [false, true]) {
        if (!nation && inSquad) continue;
        const s = player();
        s.nation = nation;
        const before = structuredClone(s);
        expect(grantSportsService(s, 'ag', '우승', inSquad)).toBe(false);
        expect(s).toEqual(before);
      }
    }
  });

  it('이미 군필·편입·특례인 선수는 반복 메달로 복무가 새로 시작되지 않는다', () => {
    for (const type of ['army', 'sangmu', 'sports', 'legacy']) {
      const s = player();
      if (type === 'sports') grantSportsService(s, 'olympic', '동메달', true);
      else if (type === 'legacy') s.mil.exempt = '아시안게임 금메달';
      else Object.assign(s.mil, { served: true, type });
      const before = structuredClone(s);
      expect(grantSportsService(s, 'ag', '우승', true)).toBe(false);
      expect(s).toEqual(before);
    }
  });

  it('신규 편입은 예약 입대를 취소하며 선수·계약·능력치와 RNG를 유지한다', () => {
    const s = player();
    Object.assign(s.mil, { applied: true, accepted: true, armyNext: true });
    const before = structuredClone(s);
    expect(grantSportsService(s, 'olympic', '은메달', true)).toBe(true);
    expect(s.mil).toMatchObject({
      applied: false,
      accepted: false,
      armyNext: false,
      served: false,
    });
    expect([s.club, s.contract, s.sub, s.year, s.age, s.rng]).toEqual([
      before.club,
      before.contract,
      before.sub,
      before.year,
      before.age,
      before.rng,
    ]);
    s.age = 28;
    expect(milDone(s)).toBe(true); // 일반 입대가 필요 없는 상태, 복무 완료와 별개
    expect(milDue(s)).toBe(false);
    expect(milCanApply(s)).toBe(false);
    expect(milOptions(s)).toEqual([]);
    expect(milEnlistMarket(s)).toBeNull();
    expect(checkTitles(s).map((t) => t.id)).not.toContain('mil');
    expect(milStatusText(s)).toContain('체육요원 복무 중');
  });

  it('34개월을 취득 다음 시즌부터 12개월씩 이행하고 저장·재정산·추가 메달에도 기간을 보존한다', () => {
    let s = player();
    grantSportsService(s, 'olympic', '동메달', true);
    milSeasonEnd(s);
    expect(s.mil.sportsService!.monthsLeft).toBe(34);
    for (const [year, remaining] of [
      [2029, 22],
      [2030, 10],
      [2031, 0],
    ]) {
      s.year = year!;
      const restored = loadSave(JSON.parse(JSON.stringify(s)))!.G;
      expect(restored.mil).toEqual(s.mil);
      s = restored;
      const note = milSeasonEnd(s);
      expect(s.mil.sportsService!.monthsLeft).toBe(remaining);
      expect(s.mil.served).toBe(remaining === 0);
      expect(note).toBe(remaining === 0 ? '체육요원 복무 완료' : null);
      const before = structuredClone(s);
      milSeasonEnd(s);
      grantSportsService(s, 'ag', '우승', true);
      expect(s).toEqual(before);
    }
    expect(milStatusText(s)).toContain('체육요원 복무 완료');
    expect(checkTitles(s).map((t) => t.id)).toContain('mil');
  });

  it.each([false, true])(
    '상무 첫 시즌 전환은 17개월로 단축하고 원소속팀 복귀·해외 계약 해지=%s를 보존한다',
    (abroad) => {
      const s = player();
      if (abroad) {
        s.leagueId = 'pl';
        s.club = { ...CLUBS.find((c) => c.leagueId === 'pl')! };
      }
      const club = { ...s.club },
        contract = { ...s.contract! };
      enlistSangmu(s);
      grantSportsService(s, 'olympic', '동메달', true);
      expect(s.mil.sportsService!.monthsLeft).toBe(17);
      expect(milStatusText(s)).toContain('편입 예정');
      expect(milSeasonEnd(s)).toContain('체육요원 전환');
      expect(s.club).toEqual(club);
      expect(s.contract!.years).toBe(abroad ? 0 : contract.years + 1);
      expect(s.mil).toMatchObject({ serving: false, served: false, left: 0 });
      expect(checkTitles(s).map((t) => t.id)).not.toContain('mil');
      s.year++;
      milSeasonEnd(s);
      expect(s.mil.sportsService!.monthsLeft).toBe(5);
      s.year++;
      milSeasonEnd(s);
      expect(s.mil.served).toBe(true);
    },
  );

  it('상무 마지막 시즌에는 이미 마친 복무 비율을 반영해 의무를 추가하지 않는다', () => {
    const s = player();
    enlistSangmu(s);
    s.mil.left = 1;
    grantSportsService(s, 'ag', '우승', true);
    milSeasonEnd(s);
    expect(s.mil).toMatchObject({ serving: false, served: true, sportsService: { monthsLeft: 0 } });
  });

  it('특례 없이 상무에서 만기 전역하는 경로를 유지한다', () => {
    const s = player();
    enlistSangmu(s);
    expect(milSeasonEnd(s)).toBe('상무 복무 1시즌 남음');
    s.year++;
    expect(milSeasonEnd(s)).toContain('상무 만기 전역');
    expect(s.mil.served).toBe(true);
    expect(s.mil.sportsService).toBeUndefined();
  });

  it('T-11-077 복무와 특례 대회가 겹치면 상무 합격·현역 입영을 미루고 소속팀에 남을 수 있다', () => {
    // 2030 아시안게임 시즌을 앞둔 23세 상무 합격자
    const s = player(1, 2030, 70, 23);
    const club = { ...s.club };
    s.mil.accepted = true;
    const m = market(s);
    expect(m.options.map((o) => o.kind)).toEqual(['serve', 'defer']);
    expect(m.note).toContain('2030 아시안게임');
    expect(s.mil).toMatchObject({ accepted: true, serving: false }); // 고르기 전엔 입대하지 않는다
    const r = acceptOption(s, m.options[1]!, m.options);
    expect(r).toMatchObject({ reopen: true });
    expect(s.mil).toMatchObject({ accepted: false, serving: false });
    expect(s.club).toEqual(club);
    expect(market(s).options.map((o) => o.kind)).not.toContain('serve');

    // 현역 입영 예약도 같다
    const a = player(1, 2030, 70, 23);
    a.mil.armyNext = true;
    const am = market(a);
    expect(am.options.map((o) => o.kind)).toEqual(['army', 'defer']);
    acceptOption(a, am.options[1]!, am.options);
    expect(a.mil).toMatchObject({ armyNext: false, served: false });
    expect(a.career.some((r) => r.mil)).toBe(false);
  });

  it('T-11-077 겹치는 특례 대회가 없으면 합격자는 상무 입대만 고르고, 고를 때 입대한다', () => {
    const s = player(1, 2031, 70, 23); // 2032 올림픽 땐 24세라 U-23 대상이 아니다
    s.mil.accepted = true;
    const m = market(s);
    expect(m.options.map((o) => o.kind)).toEqual(['serve']);
    expect(s.mil.serving).toBe(false);
    acceptOption(s, m.options[0]!, m.options);
    expect(s.mil).toMatchObject({ serving: true, accepted: false, left: 2, type: 'sangmu' });
    expect(s.club.id).toBe('sangmu');

    // 옛 저장: 시장을 열 때 이미 입대한 상태라면 다시 입대시키지 않는다
    const old = player(1, 2031, 70, 23);
    enlistSangmu(old);
    const prev = structuredClone(old.mil.prevClub);
    acceptOption(old, { kind: 'serve', first: true, name: '김천 상무 입대' }, []);
    expect(old.mil.prevClub).toEqual(prev);
    expect(old.mil.left).toBe(2);
  });

  it('실제 대회 정산에서 와일드카드 메달은 나이와 관계없이 특례로 연결한다', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const s = player(seed, 2028, 94, 27);
      const tour = natSeasonEnd(s).tours.find((t) => t.key === 'olympic')!;
      if (!['금메달', '은메달', '동메달'].includes(tour.stage)) continue;
      expect(tour).toMatchObject({ inSquad: true, why: '와일드카드 발탁' });
      expect(s.mil.exempt).toBe(`올림픽 ${tour.stage}`);
      return;
    }
    throw new Error('와일드카드 메달 표본 없음');
  });

  it('실제 대회 정산에서 한 경기도 뛰지 않은 메달 명단 선수도 편입한다', () => {
    for (let seed = 1; seed <= 10000; seed++) {
      const s = player(seed, 2028, 70);
      const tour = natSeasonEnd(s).tours.find((t) => t.key === 'olympic')!;
      if (!tour.inSquad || tour.apps || !['금메달', '은메달', '동메달'].includes(tour.stage))
        continue;
      expect(tour.matches.every((m) => m.mins === 0)).toBe(true);
      expect(s.mil.exempt).toBe(`올림픽 ${tour.stage}`);
      expect(s.mil.sportsService!.monthsLeft).toBe(34);
      return;
    }
    throw new Error('미출전 메달 표본 없음');
  });
});
