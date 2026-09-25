// 시트 본문 뷰 모델. actions.ts가 게임 상태에서 화면에 필요한 값만 골라 만들고,
// ui/sheets/*.svelte가 그대로 그린다(컴포넌트는 게임 로직을 직접 부르지 않는다).
import type { Chip } from '../sheetState.svelte.js';

export type StoryTag = { name: string; stage: number; total: number };
export type StoryNote = { name: string; ending: string | null; started: boolean };
export type NatGameView = { line: string; hl: boolean; detail: string };
export type NatView = { name: string; comp: string; called: boolean; games: NatGameView[] };
export type TourView = { name: string; stage: string; note: string; lines: string[] };
export type TickerRow = {
  key: number;
  rd: number;
  res: 'W' | 'D' | 'L';
  opp: string;
  score: string;
  mins: number;
  g: number;
  a: number;
  rating: number;
  inj: boolean;
};

/** T-10-004: 시트 dialog의 접근 가능한 이름(axe aria-dialog-name). 화면의 제목 줄과 같은 문구. */
export function sheetLabel(v: SheetView): string {
  switch (v.kind) {
    case 'judge':
    case 'eventResult':
      return v.label;
    case 'phase':
      return v.eyebrow;
    case 'market':
      return '다음 시즌, 어디서 뛸까요?';
    case 'notice':
      return v.title ?? v.eyebrow;
    default:
      return v.title;
  }
}

export type SheetView =
  | { kind: 'steps'; title: string; steps: string[]; active: number; progress: number }
  | {
      kind: 'block';
      eyebrow: string;
      title: string;
      back: boolean;
      progress: number;
      round: string;
      wdl: { w: number; d: number; l: number };
      tally: { apps: number; g: number; a: number; cs: number; rating: string };
      ticker: TickerRow[];
      extras: { text: string; done: boolean }[];
      skip: (() => void) | null;
    }
  | { kind: 'judge'; label: string; p: number; pos: number }
  | {
      kind: 'phase';
      eyebrow: string;
      block: { w: number; d: number; l: number; apps: number; goals: number; assists: number; rating: string | null; cs: number; hl: string[] } | null;
      role: string;
      comps: { t: string; good: boolean }[];
      nat: NatView[];
      chips: Chip[];
    }
  | {
      kind: 'event';
      eyebrow: string;
      title: string;
      text: string;
      story: StoryTag | null;
      choices: { label: string; odds: string; hint?: string }[];
    }
  | { kind: 'eventResult'; label: string; outcome: string; ok: boolean; text: string; chips: Chip[]; twist: string | null; story: StoryNote | null; dexNew: string | null }
  | {
      kind: 'season';
      eyebrow: string;
      title: string;
      ch: string[];
      stats: { apps: number; goals: number; col: number; colLabel: string; rating: string };
      honors: string[];
      comps: string[];
      tours: TourView[];
      gala: string[];
      miles: string[];
      notes: string[];
      fans: string[];
      age: number;
    }
  | {
      kind: 'market';
      eyebrow: string;
      note: string;
      options: { clubId?: string; name: string; lg: string; salary: string | null; sub: string | null }[];
    }
  | { kind: 'notice'; eyebrow: string; title?: string; big?: { text: string; ok: boolean }; steps?: string[]; text?: string; muted?: boolean; check?: { label: string; onChange: (on: boolean) => void } };
