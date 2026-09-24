// ───────── 반응형 앱 상태 (ui.ts 최상단 모듈 변수 포트) ─────────
// 원본은 module-level `let G/screen/tab/...` + 수동 render() 호출로 화면을 갱신했다. Svelte 5
// runes로 옮기면서 같은 상태를 하나의 반응형 객체에 모아 두고, 화면 갱신은 컴포넌트가 이 상태를
// 구독하는 것으로 대신한다(수동 render() 호출은 더 이상 필요 없다).
import type { Pos } from '../game/data.js';
import { pick } from '../game/rng.js';
import { SURNAMES, GIVEN } from '../game/data.js';
import type { GameState, HofEntry } from '../game/types.js';
import type { Candidate } from '../game/candidates.js';

export type Screen = 'home' | 'create' | 'retired' | 'game';
export type Tab = 'season' | 'player' | 'career' | 'trophy';

export interface DraftCharacter {
  name: string;
  number: number;
  pos: Pos;
  foot: GameState['foot'];
  type: string;
  trait: string;
}

export function randomName(): string {
  return pick(SURNAMES) + pick(GIVEN);
}

export const appState = $state<{
  G: GameState | null;
  screen: Screen;
  tab: Tab;
  lastRetired: HofEntry | null;
  C: DraftCharacter;
  /** T-10-002. 선수 생성 후보 카드 3장(같은 능력치 총합, 다른 분포) — 생성 화면을 벗어나면 null. */
  candidates: Candidate[] | null;
  candidatesOpen: boolean[];
  candidatePick: number | null;
}>({
  G: null,
  screen: 'home',
  tab: 'season',
  lastRetired: null,
  C: {
    name: randomName(),
    number: 10,
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
  },
  candidates: null,
  candidatesOpen: [],
  candidatePick: null,
});

export const toastState = $state<{ text: string; visible: boolean }>({ text: '', visible: false });
