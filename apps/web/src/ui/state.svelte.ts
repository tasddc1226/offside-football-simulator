// ───────── 반응형 앱 상태 (ui.ts 최상단 모듈 변수 포트) ─────────
// 원본은 module-level `let G/screen/tab/...` + 수동 render() 호출로 화면을 갱신했다. Svelte 5
// runes로 옮기면서 같은 상태를 하나의 반응형 객체에 모아 두고, 화면 갱신은 컴포넌트가 이 상태를
// 구독하는 것으로 대신한다(수동 render() 호출은 더 이상 필요 없다).
import type { BoardKey } from '@offside/contracts/board-limits';
import type { OutboxItem } from '../game/outbox.js';
import type { AttrKey, Pos } from '../game/data.js';
import { pick } from '../game/rng.js';
import { SURNAMES, GIVEN, defaultFocus } from '../game/data.js';
import type { GameState, HofEntry, LegendSource } from '../game/types.js';
import type { Candidate } from '../game/candidates.js';

export type Screen = 'home' | 'create' | 'retired' | 'game' | 'legend' | 'settings' | 'board' | 'dex';
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

/** T-10-005 은퇴 선수 상세 화면에 띄울 대상. 내 선수(로컬 ft_hof)면 `own`이 있고 이름 공개를 바꿀 수 있다. */
export interface LegendView {
  name: string;
  number: number | null;
  pos: Pos;
  age: number;
  lastClub: string;
  score: number;
  peak: number;
  /** 시즌별 상세. 옛 기록(스냅샷 없음)은 null — 요약만 보여 준다. */
  d: LegendSource | null;
  totals: { apps: number; goals: number; assists: number; trophies: number; awards: number; caps: number };
  own: HofEntry | null;
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
  /** T-10-013. 진행 중 커리어가 다른 계정 소유라 서버가 거절한 시즌 업로드(홈에서 처리를 고른다). */
  ownerConflict: OutboxItem[] | null;
}>({
  G: null,
  screen: 'home',
  tab: 'season',
  lastRetired: null,
  legend: null,
  C: {
    name: randomName(),
    number: 10,
    pos: 'FW',
    foot: '오른발',
    focus: defaultFocus('FW'),
    trait: 'late',
  },
  candidates: null,
  candidatesOpen: [],
  candidatePick: null,
  board: 'notice',
  ownerConflict: null,
});

export const toastState = $state<{ text: string; visible: boolean }>({ text: '', visible: false });
