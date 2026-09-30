// ───────── 화면 방문 기록 (웹·앱 공용, T-11-005) ─────────
// 화면은 appState로 그린다. 뒤로 가기(웹 브라우저 뒤로·가장자리 밀기, 앱 Android 뒤로 버튼·BackBar)가 이전 화면을
// 되살리도록, 화면이 바뀔 때마다 기록 하나를 쌓는다. 기록 단위는 화면(appState.screen)과 그 안의 한 단계 — 선수 생성
// 1·2단계, 소식 목록·글, 선수 상세, 구단주 팀 안의 화면, 기록실 팀 프로필 — 까지다. 게임 탭·기록실 페이지는 기록하지 않는다.
// 이미 시작한 커리어의 생성 화면, 끝난(은퇴한) 커리어의 게임 화면으로는 돌아가지 않고 홈을 연다 — 뒤로 가서 같은
// 후보로 다시 시작하거나 끝난 게임을 여는 일을 막는다.
import type { BoardKey } from '@offside/contracts/board-limits';
import type { Candidate } from '@offside/game/candidates';
import type { AppState, LegendView, Screen, TeamView } from './state.js';

export interface NavEntry {
  key: string;
  screen: Screen;
  /** 떠날 때의 스크롤 위치 — 돌아오면 그 자리로. */
  y: number;
  board: BoardKey;
  post: string | null;
  cand: { list: Candidate[]; open: boolean[]; pick: number | null } | null;
  legend: LegendView | null;
  legendBack: AppState['legendBack'];
  /** T-10-130 구단주 팀 안의 화면 · 기록실 팀 랭킹에서 연 팀 프로필. */
  teamView: TeamView;
  hofTeam: string | null;
}

// 선수 상세는 LegendView 객체마다 번호를 붙여 구분한다.
const legendIds = new WeakMap<object, number>();
let legendSeq = 0;
const legendId = (v: LegendView | null) => {
  if (!v) return 0;
  if (!legendIds.has(v)) legendIds.set(v, ++legendSeq);
  return legendIds.get(v)!;
};

/** 기록 하나로 치는 단위. 값이 바뀌면 새 기록을 쌓는다. */
export function navKey(s: AppState): string {
  const screen = s.screen;
  if (screen === 'create') return s.candidates ? 'create:cand' : 'create';
  if (screen === 'board') return `board:${s.board}:${s.boardOpenId ?? ''}`;
  if (screen === 'legend') return `legend:${legendId(s.legend)}`;
  // 팀·시즌 업적은 같은 화면의 탭이라 한 기록으로 친다.
  if (screen === 'team') return `team:${s.teamView === 'achievements' ? 'team' : s.teamView}`;
  if (screen === 'hof') return `hof:${s.hof.tab === 'teams' ? (s.hof.team ?? '') : ''}`;
  return screen;
}

export function navSnapshot(s: AppState, y: number): NavEntry {
  return {
    key: navKey(s),
    screen: s.screen,
    y,
    board: s.board,
    post: s.boardOpenId,
    cand: s.candidates
      ? { list: s.candidates, open: [...s.candidatesOpen], pick: s.candidatePick }
      : null,
    legend: s.legend,
    legendBack: s.legendBack,
    teamView: s.teamView,
    hofTeam: s.hof.tab === 'teams' ? s.hof.team : null,
  };
}

/** 기록의 화면을 되살린다(돌아갈 수 없는 화면이면 홈). 되살린 화면을 돌려준다. 시트 닫기·스크롤은 호출한 쪽이 한다. */
export function navRestore(s: AppState, e: NavEntry): Screen {
  const live = !!s.G && !s.G.retired;
  let screen = e.screen;
  if (
    (screen === 'create' && live) ||
    (screen === 'game' && !live) ||
    (screen === 'legend' && !e.legend)
  )
    screen = 'home';
  if (screen === 'create') {
    s.candidates = e.cand?.list ?? null;
    s.candidatesOpen = e.cand?.open ?? [];
    s.candidatePick = e.cand?.pick ?? null;
  }
  if (screen === 'board') {
    s.board = e.board;
    s.boardOpenId = e.post;
  }
  if (screen === 'legend') {
    s.legend = e.legend;
    s.legendBack = e.legendBack;
  }
  if (screen === 'team') s.teamView = e.teamView;
  if (screen === 'hof' && s.hof.team !== e.hofTeam)
    s.hof = { ...s.hof, team: e.hofTeam, ...(e.hofTeam ? { tab: 'teams' as const } : {}) };
  s.screen = screen;
  return screen;
}

/**
 * 앱(브라우저 기록이 없는 클라이언트)의 방문 기록 스택. 상태가 바뀔 때마다 track()을 부르면 기록 단위가 바뀐 경우에만
 * 쌓고, back()은 이전 기록을 되살린다(없으면 false — 앱을 닫거나 fallback으로).
 */
export function createNavStack(
  s: AppState,
  ui: { closeSheet(): void; scrollY(): number; scrollTo(y: number): void },
) {
  const entries: NavEntry[] = [navSnapshot(s, 0)];
  return {
    track() {
      const key = navKey(s);
      const top = entries[entries.length - 1]!;
      if (key === top.key) return;
      top.y = ui.scrollY();
      entries.push(navSnapshot(s, 0));
    },
    canGoBack: () => entries.length > 1,
    back(): boolean {
      if (entries.length < 2) return false;
      entries.pop();
      const e = entries[entries.length - 1]!;
      ui.closeSheet();
      const screen = navRestore(s, e);
      entries[entries.length - 1] = { ...navSnapshot(s, 0), y: screen === e.screen ? e.y : 0 };
      ui.scrollTo(entries[entries.length - 1]!.y);
      return true;
    },
  };
}
