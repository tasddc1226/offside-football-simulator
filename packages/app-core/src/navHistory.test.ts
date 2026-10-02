import { describe, expect, it, vi } from 'vitest';
import type { Candidate } from '@offside/game/candidates';
import type { GameState } from '@offside/game/types';
import { createNavStack, navKey, navRestore, navSnapshot, type NavEntry } from './navHistory.js';
import { initialAppState, type AppState, type LegendView } from './state.js';

const state = (over: Partial<AppState> = {}): AppState => ({ ...initialAppState(), ...over });
const live = { retired: false } as unknown as GameState;
const ended = { retired: true } as unknown as GameState;
const legendView = (name = '선수'): LegendView => ({ name }) as unknown as LegendView;
const cand = (n: number) => [{ n }] as unknown as Candidate[];

describe('navKey', () => {
  it('생성 화면은 후보 카드가 있느냐로 두 단계로 나눈다', () => {
    expect(navKey(state({ screen: 'create' }))).toBe('create');
    expect(navKey(state({ screen: 'create', candidates: cand(1) }))).toBe('create:cand');
  });
  it('소식 목록과 글은 게시판·글 id 로 구분한다', () => {
    expect(navKey(state({ screen: 'board', board: 'notice', boardOpenId: null }))).toBe(
      'board:notice:',
    );
    expect(navKey(state({ screen: 'board', board: 'release', boardOpenId: 'p1' }))).toBe(
      'board:release:p1',
    );
  });
  it('선수 상세는 LegendView 객체마다 다른 키 — 같은 객체면 같은 키, 없으면 0', () => {
    const a = legendView('a');
    const k = navKey(state({ screen: 'legend', legend: a }));
    expect(navKey(state({ screen: 'legend', legend: a }))).toBe(k);
    expect(navKey(state({ screen: 'legend', legend: legendView('b') }))).not.toBe(k);
    expect(navKey(state({ screen: 'legend', legend: null }))).toBe('legend:0');
  });
  it('팀 화면은 업적 탭을 팀 탭과 같은 기록으로 친다', () => {
    expect(navKey(state({ screen: 'team', teamView: 'achievements' }))).toBe('team:team');
    expect(navKey(state({ screen: 'team', teamView: 'team' }))).toBe('team:team');
    expect(navKey(state({ screen: 'team', teamView: 'opponents' }))).toBe('team:opponents');
    expect(navKey(state({ screen: 'team', teamView: 'history' }))).toBe('team:history');
  });
  it('기록실은 팀 탭에서 연 팀 프로필만 구분한다', () => {
    const hof = initialAppState().hof;
    const key = (tab: typeof hof.tab, team: string | null) =>
      navKey(state({ screen: 'hof', hof: { ...hof, tab, team } }));
    expect(key('legends', 't1')).toBe('hof:');
    expect(key('teams', 't1')).toBe('hof:t1');
    expect(key('teams', null)).toBe('hof:');
  });
  it('나머지 화면은 화면 이름 그대로', () => {
    expect(navKey(state({ screen: 'settings' }))).toBe('settings');
    expect(navKey(state({ screen: 'game' }))).toBe('game');
  });
});

describe('navSnapshot', () => {
  it('후보 카드는 복사해 담고 기록실 팀은 팀 탭일 때만 담는다', () => {
    const open = [true, false, false];
    const s = state({
      screen: 'create',
      candidates: cand(1),
      candidatesOpen: open,
      candidatePick: 1,
    });
    const e = navSnapshot(s, 120);
    expect(e).toMatchObject({ key: 'create:cand', screen: 'create', y: 120, hofTeam: null });
    expect(e.cand).toMatchObject({ open: [true, false, false], pick: 1 });
    expect(e.cand!.open).not.toBe(open);
    expect(navSnapshot(state(), 0).cand).toBeNull();
    const hof = initialAppState().hof;
    const teams = state({ screen: 'hof', hof: { ...hof, tab: 'teams', team: 'x' } });
    expect(navSnapshot(teams, 0).hofTeam).toBe('x');
  });
});

describe('navRestore', () => {
  const entry = (over: Partial<NavEntry>): NavEntry => ({
    ...navSnapshot(state(), 0),
    ...over,
  });
  it('이미 시작한 커리어가 있으면 생성 화면 대신 홈을 연다', () => {
    const s = state({ screen: 'settings', G: live });
    expect(navRestore(s, entry({ screen: 'create' }))).toBe('home');
    expect(s.screen).toBe('home');
  });
  it('끝난 커리어(또는 커리어 없음)의 게임 화면 대신 홈을 연다', () => {
    expect(navRestore(state({ G: ended }), entry({ screen: 'game' }))).toBe('home');
    expect(navRestore(state({ G: null }), entry({ screen: 'game' }))).toBe('home');
    expect(navRestore(state({ G: live }), entry({ screen: 'game' }))).toBe('game');
  });
  it('선수 상세 기록에 선수가 없으면 홈을 연다', () => {
    expect(navRestore(state(), entry({ screen: 'legend', legend: null }))).toBe('home');
  });
  it('생성 화면은 후보·펼침·고른 카드를 되살리고 없으면 비운다', () => {
    const s = state({ screen: 'home' });
    navRestore(s, entry({ screen: 'create', cand: { list: cand(2), open: [true], pick: 0 } }));
    expect(s).toMatchObject({ screen: 'create', candidatesOpen: [true], candidatePick: 0 });
    expect(s.candidates).toHaveLength(1);
    navRestore(s, entry({ screen: 'create', cand: null }));
    expect(s).toMatchObject({ candidates: null, candidatesOpen: [], candidatePick: null });
  });
  it('소식 화면은 게시판과 글을, 선수 상세는 선수와 돌아갈 곳을 되살린다', () => {
    const s = state();
    navRestore(s, entry({ screen: 'board', board: 'release', post: 'p9' }));
    expect(s).toMatchObject({ screen: 'board', board: 'release', boardOpenId: 'p9' });
    const v = legendView();
    navRestore(s, entry({ screen: 'legend', legend: v, legendBack: 'hof' }));
    expect(s).toMatchObject({ screen: 'legend', legendBack: 'hof' });
    expect(s.legend).toBe(v);
  });
  it('팀 화면은 팀 안의 화면을 되살린다', () => {
    const s = state({ teamView: 'team' });
    navRestore(s, entry({ screen: 'team', teamView: 'opponents' }));
    expect(s.teamView).toBe('opponents');
  });
  it('기록실은 팀 프로필을 되살리고, 팀을 열면 팀 탭으로 간다', () => {
    const s = state();
    navRestore(s, entry({ screen: 'hof', hofTeam: 't7' }));
    expect(s.hof).toMatchObject({ tab: 'teams', team: 't7' });
    navRestore(s, entry({ screen: 'hof', hofTeam: null }));
    expect(s.hof).toMatchObject({ tab: 'teams', team: null });
  });
});

describe('createNavStack', () => {
  const setup = (s: AppState) => {
    let y = 0;
    const ui = {
      closeSheet: vi.fn(),
      scrollY: vi.fn(() => y),
      scrollTo: vi.fn(),
    };
    return { stack: createNavStack(s, ui), ui, scroll: (v: number) => (y = v) };
  };
  it('처음에는 되돌아갈 곳이 없다', () => {
    const { stack, ui } = setup(state());
    expect(stack.canGoBack()).toBe(false);
    expect(stack.back()).toBe(false);
    expect(ui.closeSheet).not.toHaveBeenCalled();
  });
  it('기록 단위가 같으면 쌓지 않는다', () => {
    const s = state();
    const { stack } = setup(s);
    stack.track();
    s.tab = 'career';
    stack.track();
    expect(stack.canGoBack()).toBe(false);
  });
  it('화면이 바뀌면 쌓고, 뒤로 가면 이전 화면과 스크롤 위치를 되살린다', () => {
    const s = state({ screen: 'home' });
    const { stack, ui, scroll } = setup(s);
    scroll(300);
    s.screen = 'settings';
    stack.track();
    expect(stack.canGoBack()).toBe(true);
    expect(stack.back()).toBe(true);
    expect(s.screen).toBe('home');
    expect(ui.closeSheet).toHaveBeenCalledTimes(1);
    expect(ui.scrollTo).toHaveBeenLastCalledWith(300);
    expect(stack.canGoBack()).toBe(false);
  });
  it('돌아갈 수 없는 화면이라 홈으로 바뀌면 스크롤은 0 으로 둔다', () => {
    const s = state({ screen: 'create', candidates: cand(1) });
    const { stack, ui, scroll } = setup(s);
    scroll(50);
    s.G = live;
    s.screen = 'home';
    stack.track();
    stack.back();
    expect(s.screen).toBe('home');
    expect(ui.scrollTo).toHaveBeenLastCalledWith(0);
  });
  it('여러 단계를 차례로 되돌린다', () => {
    const s = state({ screen: 'home' });
    const { stack } = setup(s);
    s.screen = 'settings';
    stack.track();
    s.screen = 'dex';
    stack.track();
    stack.back();
    expect(s.screen).toBe('settings');
    stack.back();
    expect(s.screen).toBe('home');
    expect(stack.back()).toBe(false);
  });
});
