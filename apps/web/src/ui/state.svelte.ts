// ───────── 반응형 앱 상태 (ui.ts 최상단 모듈 변수 포트) ─────────
// 원본은 module-level `let G/screen/tab/...` + 수동 render() 호출로 화면을 갱신했다. Svelte 5
// runes로 옮기면서 같은 상태를 하나의 반응형 객체에 모아 두고, 화면 갱신은 컴포넌트가 이 상태를
// 구독하는 것으로 대신한다(수동 render() 호출은 더 이상 필요 없다).
import type { HofSort, RetiredNumberResult } from '@offside/contracts';
import type { BoardKey } from '@offside/contracts/board-limits';
import { activeSeason } from '@offside/contracts/service-seasons';
import type { OutboxItem } from '../game/outbox.js';
import type { AttrKey, Pos } from '../game/data.js';
import { pick, ri } from '../game/rng.js';
import { SURNAMES, GIVEN, defaultFocus } from '../game/data.js';
import type { GameState, HofEntry, LegendSource } from '../game/types.js';
import type { Candidate } from '../game/candidates.js';
import type { PhaseReport } from './sheets/types.js';

/** 기록실(하단 메뉴 'hof')의 탭. */
export type HofTab = 'legends' | 'rn';
/** 기록실을 열 때의 상태. 시즌이 진행 중이면 그 시즌 순위부터 보여 준다. */
export const hofStart = () => ({
  tab: 'legends' as HofTab,
  page: 1,
  sort: 'score' as HofSort,
  season: activeSeason(new Date().toISOString())?.id ?? null,
});

export type Screen =
  | 'home'
  | 'create'
  | 'retired'
  | 'game'
  | 'legend'
  | 'settings'
  | 'owner'
  | 'board'
  | 'dex'
  | 'hof'
  | 'firsts'
  | 'admin'
  | 'shared';
export type Tab = 'season' | 'player' | 'career' | 'trophy';

export interface DraftCharacter {
  name: string;
  number: number;
  pos: Pos;
  foot: GameState['foot'];
  /** T-10-008. 키우고 싶은 주력 능력치(FOCUS_PICK개). */
  focus: AttrKey[];
  trait: string;
}

export function randomName(): string {
  return pick(SURNAMES) + pick(GIVEN);
}

/** T-10-076 기본 등번호는 무작위(1~99) — 모두 10번으로 시작하면 영구결번이 10번에 몰린다. 칸은 비우고 직접 적을 수 있다. */
export const randomNumber = (): number => ri(1, 99);

/** T-10-005 은퇴 선수 상세 화면에 띄울 대상. 내 선수(로컬 ft_hof)면 `own`이 있고 이름 공개를 바꿀 수 있다. */
export interface LegendView {
  name: string;
  number: number | null;
  pos: Pos;
  age: number;
  lastClub: string;
  /** T-10-066. 옛 기록에는 없다 — 엠블럼은 이름으로 찾는다. */
  lastClubId?: string | null | undefined;
  score: number;
  peak: number;
  /** 시즌별 상세. 옛 기록(스냅샷 없음)은 null — 요약만 보여 준다. */
  d: LegendSource | null;
  totals: {
    apps: number;
    goals: number;
    assists: number;
    trophies: number;
    awards: number;
    caps: number;
  };
  own: HofEntry | null;
  /** T-10-069 공유 링크를 걸 커리어 id — 내 선수(이 기기·계정 기록) 중 명예의 전당에 오른 기록만. 아래 공유 바(ShareBar)를 띄운다. */
  shareId: string | null;
  /** T-10-026 대표 칭호 id. */
  title: string | null;
  /** T-10-073 은퇴 직후(진행 중 세이브)에만 — 실제 잠재력 공개. 저장된 기록에는 없다. */
  pot?: { real: string; scout: string; gap: number; ach: number } | undefined;
  /** T-10-076 영구결번 심사 결과. null = 자격 없음, undefined = 아직 모름(업로드 전·옛 기록). */
  rn?: RetiredNumberResult | null | undefined;
}

export const appState = $state<{
  G: GameState | null;
  screen: Screen;
  tab: Tab;
  lastRetired: HofEntry | null;
  legend: LegendView | null;
  C: DraftCharacter;
  /** T-10-002. 선수 생성 후보 카드 3장(같은 능력치 총합, 다른 분포) — 생성 화면을 벗어나면 null. */
  candidates: Candidate[] | null;
  candidatesOpen: boolean[];
  candidatePick: number | null;
  /** T-10-011. 소식 화면에서 마지막으로 본 게시판. */
  board: BoardKey;
  /** 소식 화면을 열 때 바로 펼칠 글(홈의 소식 섹션에서 누른 글). */
  boardPost: string | null;
  /** T-10-013. 진행 중 커리어가 다른 계정 소유라 서버가 거절한 시즌 업로드(홈에서 처리를 고른다). */
  ownerConflict: OutboxItem[] | null;
  /** 기록실 화면의 탭(명예의 전당·영구결번)·페이지(1부터)·순위 유형. 선수 상세에서 돌아와도 그대로다. */
  /** season: 서비스 시즌 순위(T-10-090). null이면 전체 명예의 전당. */
  hof: { tab: HofTab; page: number; sort: HofSort; season: number | null };
  /** 선수 상세의 '← 이전으로'가 돌아갈 화면. */
  legendBack: 'home' | 'hof' | 'owner';
  /** T-10-029. 공유 링크(/career/:id)로 들어온 은퇴 선수 id — 보기 전용 화면(SharedCareer)이 읽는다. */
  sharedCareer: string | null;
  /** T-10-024. 방금 끝난 구간 리포트(시즌 탭 맨 위). 저장하지 않는다 — 새로고침하면 사라진다. */
  report: PhaseReport | null;
}>({
  G: null,
  screen: 'home',
  tab: 'season',
  lastRetired: null,
  legend: null,
  C: {
    name: randomName(),
    number: randomNumber(),
    pos: 'FW',
    foot: '오른발',
    focus: defaultFocus('FW'),
    trait: 'late',
  },
  candidates: null,
  candidatesOpen: [],
  candidatePick: null,
  board: 'notice',
  boardPost: null,
  ownerConflict: null,
  hof: hofStart(),
  legendBack: 'home',
  sharedCareer: null,
  report: null,
});

export const toastState = $state<{ text: string; visible: boolean }>({ text: '', visible: false });
