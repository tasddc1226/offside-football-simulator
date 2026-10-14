import { beforeEach, describe, expect, it } from 'vitest';
import { loadHOF } from './hof-store.js';
import { legendSnapshot } from './legend.js';
import { saveKey, loadKey } from './storage.js';
import { newGame } from './engine.js';
import { createRng, setActiveRng } from './rng.js';

// vitest의 node 환경에는 localStorage가 없다 — saveKey/loadKey가 쓰는 만큼만 메모리로 흉내낸다.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('저장/불러오기 라운드트립', () => {
  it('저장한 상태를 그대로 복원한다', () => {
    setActiveRng(createRng(7));
    const g = newGame(
      { name: '홍길동', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      7,
    );
    saveKey('ft_save', g);
    const loaded = loadKey<typeof g>('ft_save');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('홍길동');
    expect(loaded!.attrs).toEqual(g.attrs);
    expect(loaded!.sub).toEqual(g.sub);
    expect(loaded!.rng).toEqual({ seed: 7 });
  });

  it('구버전 저장(sub/rng 없음)도 파싱은 그대로 성공한다 — 마이그레이션은 ui.ts 로드 시점 책임', () => {
    const legacySave = {
      v: 1,
      name: '옛날선수',
      pos: 'MF',
      attrs: { pac: 60, sho: 55, pas: 65, dri: 60, def: 50, phy: 58 },
      // sub, rng, seasonStartSub, bloom, halves 필드가 없는 옛 저장 형식
    };
    saveKey('ft_save', legacySave);
    const loaded = loadKey<typeof legacySave>('ft_save');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('옛날선수');
    expect((loaded as Record<string, unknown>).sub).toBeUndefined();
    expect((loaded as Record<string, unknown>).rng).toBeUndefined();
  });

  it('없는 키를 불러오면 null', () => {
    expect(loadKey('nope')).toBeNull();
  });

  it('명예의 전당 데이터는 ft_hof 키로 남는다', () => {
    const hof = [{ name: 'A', score: 100 }];
    saveKey('ft_hof', hof);
    expect(loadKey('ft_hof')).toEqual(hof);
  });
});

describe('T-10-005 은퇴 스냅샷', () => {
  it('서버 계약(LegendSnapshotSchema)을 통과하고 CareerRecord 부가 필드는 빠진다', async () => {
    const { LegendSnapshotSchema } = await import('@offside/contracts');

    setActiveRng(createRng(3));
    const g = newGame(
      { name: '스냅샷', number: 11, pos: 'DF', foot: '왼발', type: 'stopper', trait: 'late' },
      3,
    );
    g.career.push({
      year: 2026,
      age: 18,
      club: 'A',
      league: '고교리그',
      apps: 10,
      goals: 1,
      assists: 2,
      cs: 4,
      lgApps: 8,
      rating: 7,
      rank: 2,
      ovr: 60,
      honors: [],
      pro: false,
      comps: [],
      ch: ['cs'],
    } as never);
    g.career.push({ ...g.career[0]!, year: 2027, club: 'B', clubId: 'pl-15' });
    g.trophies.push({ year: 2026, t: '우승', club: 'A' });
    g.trophies.push({ year: 2027, t: '우승', club: 'B', clubId: 'pl-15' });
    const snap = legendSnapshot(g);
    expect(() => LegendSnapshotSchema.parse(snap)).not.toThrow();
    expect(snap.career[0]).not.toHaveProperty('lgApps');
    expect(snap.career[0]).not.toHaveProperty('comps');
    expect(snap).not.toHaveProperty('name');
    // T-10-066: 클럽 id는 있는 기록에만 옮긴다(옛 기록엔 키 자체가 없다).
    expect(snap.lastClubId).toBe(g.club.id);
    expect(snap.career[0]).not.toHaveProperty('clubId');
    expect(snap.career[1]?.clubId).toBe('pl-15');
    expect(snap.trophies[0]).not.toHaveProperty('clubId');
    expect(snap.trophies[1]?.clubId).toBe('pl-15');
    // T-10-086: A매치 골·도움도 남긴다.
    expect(snap.nat).toEqual({ caps: g.nat.caps, goals: g.nat.goals, assists: g.nat.assists });
  });
});

// T-10-034: 진학할 때 1학년으로 시작해 시즌 끝마다 +1 되는 바람에 3시즌 만에 졸업하고, 학년 표시가 한 해씩 앞섰다.
describe('대학 4년', () => {
  it('진학 후 네 시즌을 뛸 수 있고, 학년 표시가 마친 학년과 같다', async () => {
    await import('./index.js');
    const { acceptOption, endSeason, market } = await import('./season.js');
    setActiveRng(createRng(3));
    const s = newGame(
      { name: '대학생', number: 7, pos: 'MF', foot: '오른발', type: 'maker', trait: 'late' },
      3,
    );
    acceptOption(s, { kind: 'uni', name: '대학 진학', desc: '' });
    const notes: string[] = [];
    for (let year = 1; year <= 4; year++) {
      endSeason(s);
      const m = market(s);
      notes.push(m.note);
      const stay = m.options.find((o) => o.kind === 'stay');
      if (year < 4) {
        expect(stay?.desc).toBe(`${year + 1}학년으로 한 시즌 더`);
        acceptOption(s, stay!);
      } else {
        expect(stay).toBeUndefined();
      }
    }
    expect(notes[0]).toContain('대학 1학년을 마쳤습니다');
  });
});

describe('로컬 명예의 전당 30명 한도', () => {
  it('30명이 찬 상태에서 점수가 낮은 선수로 은퇴해도 방금 은퇴한 선수는 남는다', async () => {
    const { retire } = await import('./season.js');
    saveKey(
      'ft_hof',
      Array.from({ length: 30 }, (_, i) => ({ name: `고수${i}`, score: 5000 - i })),
    );
    setActiveRng(createRng(5));
    const g = newGame(
      { name: '막내', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      5,
    );
    g.age = 25;
    const entry = retire(g);
    const hof = loadHOF();
    expect(hof).toHaveLength(30);
    expect(hof.at(-1)).toMatchObject({ name: '막내', id: entry.id });
    expect(hof.some((h) => h.name === '고수29')).toBe(false);
  });
  it('같은 커리어가 다시 은퇴하면 기록을 바꾸고, 예전에 겹친 기록은 하나로 읽는다(T-10-107)', async () => {
    const { retire } = await import('./season.js');
    saveKey('ft_hof', [
      { name: '겹침', id: 'dup', score: 900 },
      { name: '겹침', id: 'dup', score: 900 },
      { name: '옛 기록', score: 100 },
      { name: '옛 기록', score: 100 },
    ]);
    expect(loadHOF().map((h) => h.name)).toEqual(['겹침', '옛 기록', '옛 기록']);
    setActiveRng(createRng(5));
    const g = newGame(
      { name: '두 번', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      5,
    );
    g.age = 25;
    retire(g);
    const again = retire(g);
    expect(loadHOF().filter((h) => h.id === again.id)).toHaveLength(1);
  });
});

describe('T-11-072 은퇴 선수 국적 저장', () => {
  it.each(['BR', 'GB-ENG', 'KR'])(
    '%s 국적을 새 은퇴 기록에 명시하고 기존 스냅샷 계약을 유지한다',
    async (nation) => {
      const { retire } = await import('./season.js');
      const { LegendSnapshotSchema } = await import('@offside/contracts');
      setActiveRng(createRng(5));
      const g = newGame(
        {
          name: '국적 확인',
          number: 7,
          pos: 'FW',
          foot: '오른발',
          type: 'poacher',
          trait: 'late',
          nation,
        },
        5,
      );
      g.age = 25;
      const h = retire(g);
      expect(h.nation).toBe(nation);
      expect(loadHOF().find((x) => x.id === h.id)?.nation).toBe(nation);
      expect(LegendSnapshotSchema.parse(h.detail)).toEqual(h.detail);
      expect(h.detail).not.toHaveProperty('nation');
    },
  );

  it('loadHOF는 같은 커리어 원본으로만 보완하고 저장된 옛 기록을 덮어쓰지 않는다', async () => {
    setActiveRng(createRng(5));
    const g = newGame(
      {
        name: '국적 확인',
        number: 7,
        pos: 'FW',
        foot: '오른발',
        type: 'poacher',
        trait: 'late',
        nation: 'BR',
      },
      5,
    );
    g.retired = true;
    saveKey('ft_save', g);
    const old = [
      { id: g.cid, name: g.name, score: 100, title: '기존 칭호' },
      { id: 'other', name: g.name, score: 50 },
    ];
    saveKey('ft_hof', old);
    expect(loadHOF()[0]).toEqual({ ...old[0], nation: 'BR' });
    expect(loadHOF()[1]).toEqual(old[1]);
    expect(loadKey('ft_hof')).toEqual(old);
  });
});

// T-11-224: 고교·대학에서 너무 잘 크면 제의 후보가 비어 K3 최약체 입단 테스트만 남았다.
describe('아마추어 고OVR 제의', () => {
  it('하한에 걸려도 갈 수 있는 구단 중 센 곳에서 제의가 온다', async () => {
    await import('./index.js');
    const { acceptOption, makeOffers } = await import('./season.js');
    const { clubsIn } = await import('./engine.js');
    setActiveRng(createRng(5));
    const s = newGame(
      { name: '대학생', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      5,
    );
    acceptOption(s, { kind: 'uni', name: '대학 진학', desc: '' });
    for (const key of Object.keys(s.sub)) s.sub[key] = 99;
    const weakestK3 = clubsIn('k3').sort((a, b) => a.str - b.str)[0]!;
    const offers = makeOffers(s);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.map((o) => o.name)).not.toContain(weakestK3.name);
  });
});

describe('T-11-257 임대', () => {
  const setup = async () => {
    await import('./index.js');
    const season = await import('./season.js');
    const { CLUBS } = await import('./data.js');
    setActiveRng(createRng(9));
    const s = newGame(
      { name: '임대생', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      9,
    );
    const parent = CLUBS.find((c) => c.leagueId === 'pl' && c.str >= 80)!;
    Object.assign(s, { club: { ...parent }, leagueId: 'pl', age: 21, phase: 0 });
    s.contract = { years: 2, salary: 5000 };
    s.flags.loanReq = s.year - 1;
    return { s, parent, ...season };
  };
  it('요청한 다음 시장에 임대 제의가 오고, 잘 뛰고 돌아오면 복귀·완전 이적을 고른다', async () => {
    const { s, parent, market, acceptOption } = await setup();
    const m = market(s);
    const loans = m.options.filter((o) => o.kind === 'offer' && o.loan === 'out');
    expect(loans.length).toBeGreaterThan(0);
    for (const o of loans) expect(o).toMatchObject({ years: 1, salary: 5000, fee: 0 });
    const pick = loans[0]!;
    acceptOption(s, pick, m.options);
    expect(s.loan?.club.id).toBe(parent.id);
    expect(s.club.id).toBe(pick.kind === 'offer' ? pick.clubId : '');
    expect(s.contract).toEqual({ years: 2, salary: 5000 });

    s.career.push({
      ...{ year: s.year, age: s.age, club: s.club.name, clubId: s.club.id, league: '-' },
      ...{ apps: 30, goals: 6, assists: 3, cs: 0, rating: 7.1, rank: 3, ovr: 60, honors: [] },
      ...{ pro: true, loan: true },
    });
    s.year++;
    s.age++;
    s.contract = { years: 1, salary: 5000 };
    const m2 = market(s);
    const back = m2.options.find((o) => o.kind === 'stay' && o.loanBack);
    const buy = m2.options.find((o) => o.kind === 'offer' && o.loan === 'buy');
    expect(back).toBeTruthy();
    expect(buy && buy.kind === 'offer' && buy.clubId).toBe(s.club.id);
    expect(m2.options.some((o) => o.kind === 'offer' && o.clubId === parent.id && !o.loan)).toBe(
      false,
    );
    acceptOption(s, back!, m2.options);
    expect(s.club.id).toBe(parent.id);
    expect(s.loan).toBeUndefined();
    expect(s.trust).toBe(2);
  });
  it('요청하지 않았거나 임대 중에 입대 기한이 오면 임대 제의가 없다', async () => {
    const { s, loanEligible } = await setup();
    expect(loanEligible(s)).toBe(true);
    expect(loanEligible({ ...s, flags: {} })).toBe(false);
    expect(loanEligible({ ...s, age: 27 })).toBe(false);
    expect(loanEligible({ ...s, contract: { years: 0, salary: 5000 } })).toBe(false);
  });
});
