// 시트 본문 뷰 모델. actions.ts가 게임 상태에서 화면에 필요한 값만 골라 만들고,
// ui/sheets/*.svelte가 그대로 그린다(컴포넌트는 게임 로직을 직접 부르지 않는다).
import type { Chip } from '../sheetState.svelte.js';
import type { TitleView } from '../../game/titles.js';
import type { ResolveResult } from '../../game/event-runner.js';
import type { MgKind } from '../../game/minigame.js';
import type { DragPoint, ShotResult } from '../../game/dragShot.js';

export type StoryTag = { name: string; stage: number; total: number };
export type StoryNote = NonNullable<ResolveResult['story']>;
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
  /** 출전한 경기(mins > 0)에만 있다. */
  g?: number | undefined;
  a?: number | undefined;
  rating?: number | undefined;
  inj: boolean;
};

export const RES_LABEL = { W: '승', D: '무', L: '패' } as const;

/** T-10-024: 구간(프리시즌·전반기·후반기)을 마친 뒤 시즌 탭 맨 위에 그리는 리포트. */
export type PhaseReport = {
  /** 새 리포트마다 바뀌어 카드 애니메이션을 처음부터 다시 건다. */
  key: number;
  year: number;
  eyebrow: string;
  title: string;
  /** 수비수·골키퍼는 도움 대신 무실점을 보여 준다. */
  back: boolean;
  block: {
    w: number;
    d: number;
    l: number;
    apps: number;
    goals: number;
    assists: number;
    rating: string | null;
    cs: number;
    hl: string[];
  } | null;
  games: TickerRow[];
  rank: { before: number | null; after: number | null };
  role: string;
  comps: { t: string; good: boolean }[];
  nat: NatView[];
  chips: Chip[];
  titles: TitleView[];
};

/** T-10-004: 시트 dialog의 접근 가능한 이름(axe aria-dialog-name). 화면의 제목 줄과 같은 문구. */
export function sheetLabel(v: SheetView): string {
  switch (v.kind) {
    case 'judge':
    case 'minigame':
    case 'dragShot':
    case 'eventResult':
      return v.label;
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
      /** T-10-028: 구간 경기를 한 경기씩 흘려보내는 중계 시트(T-10-024 전의 연출). 끝나면 리포트로 넘어간다. */
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
      /** T-10-089 원터치 미니게임. 탭하면 onTap(바늘 위치)을 부르고, 판정이 나면 ok가 채워져 결과 장면을 그린다. */
      kind: 'minigame';
      label: string;
      mg: MgKind;
      /** 초록 구간의 가운데·넓이(게이지 전체 대비 0–1). */
      center: number;
      w: number;
      /** 선택지가 정한 방향(-1 왼쪽 · 0 제자리). null이면 화면에서 무작위로 고른다. */
      side: -1 | 0 | null;
      ok: boolean | null;
      /** x: 멈춘 바늘 위치. null이면 제한 시간이 지났다(실패). */
      onTap: (x: number | null) => void;
    }
  | {
      /** T-10-089 드래그 슛(프로토타입). 손을 떼면 onShot(경로)을 부르고, 판정이 나면 shot이 채워진다. */
      kind: 'dragShot';
      label: string;
      shot: ShotResult | null;
      /** path가 null이면 제한 시간 안에 차지 않았다(실패). */
      onShot: (path: DragPoint[] | null) => void;
    }
  | {
      kind: 'event';
      eyebrow: string;
      title: string;
      text: string;
      story: StoryTag | null;
      choices: { label: string; odds: string; hint?: string }[];
    }
  | {
      kind: 'eventResult';
      label: string;
      outcome: string;
      ok: boolean;
      text: string;
      chips: Chip[];
      twist: string | null;
      story: StoryNote | null;
      dexNew: string | null;
      /** T-10-089 미니게임으로 가렸으면 탭 결과 한 줄(timingNote). */
      timing?: string | null;
    }
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
      titles: TitleView[];
      notes: string[];
      /** T-10-112 고3 첫 시즌 뒤 처음 공개하는 스카우트 잠재력 평가(그 외 시즌은 null). */
      scout: string | null;
      fans: string[];
      age: number;
    }
  | {
      kind: 'market';
      eyebrow: string;
      note: string;
      options: {
        clubId?: string;
        name: string;
        lg: string;
        salary: string | null;
        sub: string | null;
      }[];
    }
  | {
      kind: 'notice';
      eyebrow: string;
      title?: string;
      big?: { text: string; ok: boolean };
      steps?: string[];
      text?: string;
      muted?: boolean;
      check?: { label: string; onChange: (on: boolean) => void };
    };
