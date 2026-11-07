import { describe, expect, it } from 'vitest';
import {
  createRetireExpMetrics,
  dwellBucket,
  elapsedBucket,
  parseRetireExpStore,
  readyMs,
  RETIRE_EXP_WINDOW_MS,
  type AccountKey,
  type RetireExposure,
} from './retireExpMetrics.js';
import { emitClubSignal, onClubSignal, setClubAccountKey, signalOn } from './clubSignals.js';

function setup(o: { allowed?: boolean; account?: AccountKey } = {}) {
  const state = {
    allowed: o.allowed ?? true,
    raw: null as string | null,
    now: 1_000_000,
    account: ('account' in o ? o.account : 'k1') as AccountKey,
  };
  const sent: { name: string; params: Record<string, unknown> }[] = [];
  const m = createRetireExpMetrics({
    allowed: () => state.allowed,
    read: () => state.raw,
    write: (raw) => {
      state.raw = raw;
    },
    send: (name, params) => sent.push({ name, params }),
    now: () => state.now,
    account: () => state.account,
  });
  const names = () => sent.map((e) => e.name);
  const outcomes = () =>
    sent.filter((e) => e.name === 'retire_exp_outcome').map((e) => e.params.outcome);
  return { m, state, sent, names, outcomes };
}
const X = (over: Partial<RetireExposure> = {}): RetireExposure => ({
  arm: 'treatment',
  cid: 'c1',
  order: 'first',
  upload: 'done',
  account: 'guest',
  scenes: 3,
  readyMs: 120.4,
  pk: 'k1',
  ...over,
});

describe('노출 · 상호작용 (T-11-669)', () => {
  it('노출은 커리어마다 한 번, 대조군도 같은 이름 · 같은 필드로 보낸다', () => {
    const { m, sent } = setup();
    m.view(X());
    m.view(X());
    m.view(X({ cid: 'c2', arm: 'control', scenes: 0 }));
    expect(sent.map((e) => e.name)).toEqual(['retire_exp_exposure', 'retire_exp_exposure']);
    expect(sent[0]!.params).toEqual({
      exp_id: 'retire_scenes_v1',
      arm: 'treatment',
      retire_order: 'first',
      upload_state: 'done',
      account_state: 'guest',
      scene_count: 3,
      ready_ms: 120,
    });
    expect(Object.keys(sent[1]!.params).sort()).toEqual(Object.keys(sent[0]!.params).sort());
    expect(sent[1]!.params.arm).toBe('control');
  });

  it('보내는 값에 커리어 id · 계정 키 · 이름이 없다', () => {
    const { m, sent } = setup({ account: 'secret-pk' });
    m.view(X({ cid: 'secret-career-id', pk: 'secret-pk' }));
    m.scene('treatment', 'first_apps');
    m.cta('treatment', 'login');
    m.leave('treatment', { dwellMs: 3000, interacted: false, via: 'hide' });
    m.complete({ cid: 'other', year: 2030, phase: 1, matches: 3 });
    expect(sent.length).toBeGreaterThan(3);
    expect(JSON.stringify(sent)).not.toContain('secret');
  });

  it('동의하지 않았으면 저장도 전송도 하지 않는다', () => {
    const { m, state, sent } = setup({ allowed: false });
    m.view(X());
    m.scene('treatment', 'last_apps');
    m.cta('treatment', 'team');
    m.complete({ cid: 'c9', year: 2030, phase: 1, matches: 3 });
    m.club('club_match', 'k1');
    m.leave('treatment', { dwellMs: 1, interacted: true, via: 'nav' });
    expect(state.raw).toBeNull();
    expect(sent).toEqual([]);
  });

  it('동의 · SDK가 늦게 준비되면 그때 노출을 보내고, 그 전 클릭은 되돌려 보내지 않는다', () => {
    const { m, state, names } = setup({ allowed: false });
    m.view(X());
    m.scene('treatment', 'first_apps'); // 노출 전 클릭
    m.cta('treatment', 'login');
    expect(m.exposed('treatment')).toBe(false);
    state.allowed = true;
    m.ready();
    expect(m.exposed('treatment')).toBe(true);
    m.scene('treatment', 'peak_rating'); // 노출 뒤 클릭
    expect(names()).toEqual(['retire_exp_exposure', 'retire_exp_scene_open']);
  });

  it('노출 전에 화면을 떠나면 보류한 노출을 버린다(떠남 · 클릭도 보내지 않는다)', () => {
    const { m, state, sent } = setup({ allowed: false });
    m.view(X());
    m.leave('treatment', { dwellMs: 1000, interacted: false, via: 'nav' });
    state.allowed = true;
    m.ready();
    m.cta('treatment', 'team');
    expect(sent).toEqual([]);
    expect(state.raw).toBeNull();
  });

  it('가림(hide)은 떠남을 보내되 돌아와 누른 것은 받고, nav는 화면을 닫는다', () => {
    const { m, names } = setup();
    m.view(X());
    m.leave('treatment', { dwellMs: 5000, interacted: false, via: 'hide' });
    m.cta('treatment', 'login');
    m.leave('treatment', { dwellMs: 9000, interacted: true, via: 'nav' });
    m.scene('treatment', 'first_apps');
    expect(names()).toEqual([
      'retire_exp_exposure',
      'retire_exp_leave',
      'retire_exp_cta_click',
      'retire_exp_leave',
    ]);
  });

  it('다른 군 이름으로 온 클릭은 보내지 않는다', () => {
    const { m, names } = setup();
    m.view(X({ arm: 'control' }));
    m.scene('treatment', 'first_apps');
    m.cta('control', 'legacy_club');
    expect(names()).toEqual(['retire_exp_exposure', 'retire_exp_cta_click']);
  });

  it('같은 커리어 화면을 다시 열면 노출은 다시 세지 않지만 클릭은 받는다', () => {
    const a = setup();
    a.m.view(X());
    a.m.end();
    a.m.view(X());
    a.m.cta('treatment', 'team');
    expect(a.names()).toEqual(['retire_exp_exposure', 'retire_exp_cta_click']);
  });
});

describe('결과 귀속 (실제 완료 경계 · 같은 계정)', () => {
  it('다음 유효 플레이는 다른 커리어의 리그 반기 완료(경기 1번 이상)에서 한 번만 남긴다', () => {
    const { m, sent, state } = setup();
    m.view(X());
    m.complete({ cid: 'c1', year: 2030, phase: 1, matches: 5 }); // 은퇴한 그 커리어
    m.complete({ cid: 'c2', year: 2030, phase: 0, matches: 5 }); // 프리시즌
    m.complete({ cid: 'c2', year: 2030, phase: 1, matches: 0 }); // 경기 없음
    expect(sent.filter((e) => e.name === 'retire_exp_outcome')).toEqual([]);
    state.now += 2 * 3_600_000;
    m.complete({ cid: 'c2', year: 2030, phase: 1, matches: 5 });
    m.complete({ cid: 'c2', year: 2030, phase: 2, matches: 5 });
    const out = sent.filter((e) => e.name === 'retire_exp_outcome');
    expect(out).toHaveLength(1);
    expect(out[0]!.params).toMatchObject({
      arm: 'treatment',
      outcome: 'next_play',
      retire_order: 'first',
      elapsed: '1h_24h',
    });
  });

  it('구단 결과는 요청 당시 계정과 지금 계정이 노출 때 계정과 같을 때만, 한 번씩', () => {
    const { m, sent, outcomes } = setup();
    m.view(X({ arm: 'control', order: 'repeat' }));
    m.club('team_save', 'k1');
    m.club('team_save', 'k1');
    m.club('club_match', 'k1');
    expect(outcomes()).toEqual(['team_save', 'club_match']);
    expect(sent.at(-1)!.params).toMatchObject({
      arm: 'control',
      retire_order: 'repeat',
      elapsed: 'lt1h',
    });
  });

  it('A 노출 → 로그아웃 → B 로그인 뒤의 다음 플레이 · 구단 결과는 A에 붙지 않는다', () => {
    const h = setup({ account: 'A' });
    h.m.view(X({ pk: 'A' }));
    expect(parseRetireExpStore(h.state.raw).cur).toBeDefined(); // A로 노출됐다
    // 로그아웃(계정 없음)
    h.state.account = null;
    h.m.account(null);
    expect(parseRetireExpStore(h.state.raw).cur).toBeUndefined();
    h.state.account = 'B';
    h.m.account('B');
    h.m.complete({ cid: 'c2', year: 2030, phase: 1, matches: 3 });
    h.m.club('club_match', 'B');
    expect(h.outcomes()).toEqual([]);

    // 계정 변경 알림이 오기 전에 결과가 먼저 와도 지금 계정이 다르면 귀속하지 않고 지운다.
    const g = setup({ account: 'A' });
    g.m.view(X({ pk: 'A' }));
    expect(parseRetireExpStore(g.state.raw).cur).toBeDefined();
    g.state.account = 'B';
    g.m.complete({ cid: 'c2', year: 2030, phase: 1, matches: 3 });
    expect(g.outcomes()).toEqual([]);
    expect(parseRetireExpStore(g.state.raw).cur).toBeUndefined();
    g.state.account = 'A'; // A로 돌아와도 이미 지운 귀속은 되살리지 않는다
    g.m.club('club_match', 'A');
    expect(g.outcomes()).toEqual([]);
  });

  it('계정을 아직 모르면(확인 중 · 연결 실패) 귀속하지 않고, 확인되면 그때 귀속한다', () => {
    const h = setup({ account: 'A' });
    h.m.view(X({ pk: 'A' }));
    h.state.account = undefined;
    h.m.complete({ cid: 'c2', year: 2030, phase: 1, matches: 3 });
    h.m.club('club_match', undefined);
    h.m.account(undefined);
    expect(h.outcomes()).toEqual([]);
    expect(parseRetireExpStore(h.state.raw).cur).toBeDefined();
    h.state.account = 'A';
    h.m.complete({ cid: 'c2', year: 2030, phase: 2, matches: 3 });
    expect(h.outcomes()).toEqual(['next_play']);
  });

  it('A로 보낸 구단 요청의 응답이 B로 바뀐 뒤 오면 귀속하지 않는다', async () => {
    const h = setup({ account: 'A' });
    h.m.view(X({ pk: 'A' }));
    const off = onClubSignal((sig, key) => h.m.club(sig, key));
    setClubAccountKey(() => h.state.account);
    let resolve!: (r: { ok: boolean }) => void;
    const pending = signalOn(new Promise<{ ok: boolean }>((r) => (resolve = r)), 'club_match');
    // 요청을 보낸 뒤 계정이 B로 바뀌고, 다시 A로 돌아왔다고 해도 요청 당시 계정(A) · 지금 계정(B)이 맞아야 한다.
    h.state.account = 'B';
    resolve({ ok: true });
    await pending;
    expect(h.outcomes()).toEqual([]);

    // 요청 당시 계정을 몰랐으면(undefined) 지금 계정이 같아도 귀속하지 않는다.
    const k = setup({ account: 'A' });
    k.m.view(X({ pk: 'A' }));
    k.m.club('club_match', undefined);
    expect(k.outcomes()).toEqual([]);
    k.m.club('club_match', 'A');
    expect(k.outcomes()).toEqual(['club_match']);
    off();
    setClubAccountKey(() => undefined);
  });

  it('7일이 지나면 묻지 않고, 노출 없이 온 결과는 버린다', () => {
    const c = setup();
    c.m.view(X());
    c.state.now += RETIRE_EXP_WINDOW_MS + 1;
    c.m.club('club_match', 'k1');
    expect(c.outcomes()).toEqual([]);

    const a = setup();
    a.m.club('club_match', 'k1');
    a.m.complete({ cid: 'x', year: 1, phase: 1, matches: 1 });
    expect(a.sent).toEqual([]);
  });

  it('앱 재시작(저장에서 다시 읽기)에도 같은 노출에 묶는다', () => {
    const b = setup();
    b.m.view(X());
    const sent2: string[] = [];
    const m2 = createRetireExpMetrics({
      allowed: () => true,
      read: () => b.state.raw,
      write: (raw) => {
        b.state.raw = raw;
      },
      send: (name, p) => sent2.push(`${name}:${String(p.outcome ?? '')}`),
      now: () => b.state.now + 1000,
      account: () => 'k1',
    });
    m2.club('club_match', 'k1');
    m2.view(X());
    expect(sent2).toEqual(['retire_exp_outcome:club_match']);
  });

  it('깨진 저장값 · 계정 키가 없는 옛 형식은 빈 값으로 읽는다', () => {
    expect(parseRetireExpStore(null)).toEqual({ v: 1, seen: [] });
    expect(parseRetireExpStore('{')).toEqual({ v: 1, seen: [] });
    expect(parseRetireExpStore('{"v":2,"seen":[]}')).toEqual({ v: 1, seen: [] });
    const cur = { arm: 'treatment', cid: 'a', order: 'first', at: 1, done: [] };
    expect(
      parseRetireExpStore(
        JSON.stringify({ v: 1, seen: ['a'], cur: { ...cur, arm: 'x', pk: 'k' } }),
      ),
    ).toEqual({
      v: 1,
      seen: ['a'],
    });
    expect(
      parseRetireExpStore(JSON.stringify({ v: 1, seen: ['a'], cur: { ...cur, pk: null } })),
    ).toEqual({
      v: 1,
      seen: ['a'],
    });
  });

  it('구간 값', () => {
    expect(elapsedBucket(0)).toBe('lt1h');
    expect(elapsedBucket(3_600_000)).toBe('1h_24h');
    expect(elapsedBucket(86_400_000)).toBe('1d_7d');
    expect(dwellBucket(9_999)).toBe('lt10');
    expect(dwellBucket(10_000)).toBe('10_60');
    expect(dwellBucket(60_000)).toBe('gt60');
    expect(readyMs(-5)).toBe(0);
    expect(readyMs(Number.NaN)).toBe(0);
    expect(readyMs(99_999)).toBe(60_000);
  });
});

describe('clubSignals', () => {
  it('성공 응답이고 조건을 만족할 때만, 요청 당시 계정 키와 함께 알린다', async () => {
    const got: string[] = [];
    let key: AccountKey = 'A';
    setClubAccountKey(() => key);
    const off = onClubSignal((s, k) => got.push(`${s}:${String(k)}`));
    await signalOn(Promise.resolve({ ok: false }), 'club_match');
    await signalOn(
      Promise.resolve({ ok: true, data: { live: {} } }),
      'club_match',
      (r) => !r.data.live,
    );
    const p = signalOn(
      Promise.resolve({ ok: true, data: {} as { live?: object } }),
      'club_match',
      (r) => !r.data.live,
    );
    key = 'B';
    await p;
    await signalOn(Promise.resolve({ ok: true }), 'team_save');
    emitClubSignal('team_save', null);
    off();
    emitClubSignal('club_match', 'A');
    setClubAccountKey(() => undefined);
    expect(got).toEqual(['club_match:A', 'team_save:B', 'team_save:null']);
  });
});

describe('계정을 모를 때', () => {
  it('귀속 기록이 있으면 계정 확인을 부탁하고 귀속은 미룬다', () => {
    let asked = 0;
    let account: AccountKey = 'A';
    const sent: string[] = [];
    let raw: string | null = null;
    const m = createRetireExpMetrics({
      allowed: () => true,
      read: () => raw,
      write: (r) => {
        raw = r;
      },
      send: (n, p) => sent.push(`${n}:${String(p.outcome ?? '')}`),
      now: () => 1,
      account: () => account,
      needAccount: () => asked++,
    });
    account = undefined;
    m.complete({ cid: 'x', year: 1, phase: 1, matches: 1 }); // 기록 없음: 묻지 않는다
    expect(asked).toBe(0);
    account = 'A';
    m.view(X({ pk: 'A' }));
    account = undefined; // 다음 실행처럼 계정을 아직 모른다
    m.complete({ cid: 'x', year: 1, phase: 1, matches: 1 });
    expect(asked).toBe(1);
    expect(sent).toEqual(['retire_exp_exposure:']);
    account = 'A';
    m.complete({ cid: 'x', year: 1, phase: 2, matches: 1 });
    expect(sent).toEqual(['retire_exp_exposure:', 'retire_exp_outcome:next_play']);
  });
});

describe('보류 · 표시 중 계정 변경 (2차 리뷰)', () => {
  it('동의 전 A 화면 보류 → 로그아웃 · B → ready()여도 A 노출 · 클릭 · 귀속 기록이 생기지 않는다', () => {
    for (const next of [null, 'B'] as const) {
      const h = setup({ allowed: false, account: 'A' });
      h.m.view(X({ pk: 'A' }));
      h.state.account = next;
      h.m.account(next); // 계정 변경 알림(동의 전이어도 보류 화면을 버린다)
      h.state.allowed = true;
      h.m.ready();
      h.m.cta('treatment', 'team');
      h.m.scene('treatment', 'first_apps');
      h.m.leave('treatment', { dwellMs: 1, interacted: true, via: 'nav' });
      expect(h.sent).toEqual([]);
      expect(parseRetireExpStore(h.state.raw).cur).toBeUndefined();
    }
  });

  it('계정 변경 알림 없이 ready()가 먼저 와도 지금 계정이 다르면 보내지 않는다', () => {
    const h = setup({ allowed: false, account: 'A' });
    h.m.view(X({ pk: 'A' }));
    h.state.account = 'B';
    h.state.allowed = true;
    h.m.ready();
    h.state.account = 'A'; // 버린 화면은 되살리지 않는다
    h.m.ready();
    h.m.cta('treatment', 'team');
    expect(h.sent).toEqual([]);
  });

  it('계정을 모르는 동안은 노출을 미루고, 같은 계정으로 확인되면 보낸다', () => {
    const h = setup({ account: undefined });
    h.m.view(X({ pk: 'A' }));
    expect(h.names()).toEqual([]);
    h.state.account = 'A';
    h.m.account('A');
    expect(h.names()).toEqual(['retire_exp_exposure']);
  });

  it('노출 뒤 계정이 바뀌면 그 화면의 클릭 · 떠남을 보내지 않는다', () => {
    const h = setup({ account: 'A' });
    h.m.view(X({ pk: 'A' }));
    h.state.account = 'B';
    h.m.cta('treatment', 'team');
    h.m.leave('treatment', { dwellMs: 1, interacted: true, via: 'nav' });
    expect(h.names()).toEqual(['retire_exp_exposure']);
  });
});
