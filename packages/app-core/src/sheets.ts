// 시트 본문 뷰 모델. 게임 진행 액션(game-actions.ts)이 게임 상태에서 화면에 필요한 값만 골라 만들고,
// 웹(ui/sheets/*.svelte)·앱 시트 컴포넌트가 그대로 그린다(컴포넌트는 게임 로직을 직접 부르지 않는다).
import type { Chip } from '@offside/game/stats';
import type { TitleView } from '@offside/game/titles';
import type { Promotion } from '@offside/game/promotion';
import type { ResolveResult } from '@offside/game/event-runner';
import type { MgKind } from '@offside/game/minigame';
import type { DragPoint, ShotResult } from '@offside/game/dragShot';
import type { FlightMap } from './flight.js';
import type { PeekChip } from './eventPeek.js';
import type { GrowthDirInfo } from './ratingReport.js';
import type { BlockResult, MatchGame } from '@offside/game/match';
import { shellText } from './i18n/ko/shell.js';

export type { Chip };
export type SheetButton = { label: string; cls?: string; fn: () => void };

export type StoryTag = { name: string; stage: number; total: number };
type StoryNote = NonNullable<ResolveResult['story']>;
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

export const RES_LABEL = {
  get W() {
    return shellText.resWin;
  },
  get D() {
    return shellText.resDraw;
  },
  get L() {
    return shellText.resLoss;
  },
} as const;

/** T-10-024: 구간(프리시즌·전반기·후반기)을 마친 뒤 시즌 탭 맨 위에 그리는 리포트. */
export type PhaseReport = {
  /** 새 리포트마다 바뀌어 카드 애니메이션을 처음부터 다시 건다. */
  key: number;
  year: number;
  /** 끝난 구간(0 프리시즌·1 전반기·2 후반기). 시즌 탭 '최근 소식'이 리포트와 겹치는 이 구간 기록을 뺄 때 쓴다. */
  ph: number;
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
  /** games: T-11-186 이번 구간 그 대회 경기별 줄(옛 리포트·시즌 기록 복원에는 없다). */
  comps: { t: string; good: boolean; games?: NatGameView[] }[];
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
      return shellText.marketLabel;
    case 'notice':
      return v.title ?? v.eyebrow;
    default:
      return v.title;
  }
}

/** T-11-390 결정적 장면 카드(문구는 지금 언어로 만든 것). */
export type MomentCard = {
  key: string;
  kind: 'chance' | 'crisis';
  final: boolean;
  title: string;
  head: string;
  scene: string;
  /** T-11-438 실패하면 무엇을 잃는지 한 줄(리그 찬스: 기록이 줄 수 있음, 위기: 실점 · 패배, 결승: 준우승). */
  stake: string;
  /** rec: T-11-438 미드필더 리그 찬스에서 성공하면 남는 기록(골 · 도움). 선택지마다 다른 성격을 보인다. */
  choices: { id: string; label: string; pct: number; attr: string; rec?: string }[];
  /** 감독에게 맡겼을 때 성공 확률(%). */
  auto: number;
};
export type MomentView = MomentCard & {
  /** 남은 초 · 제한 시간(초). */
  left: number;
  secs: number;
  /** 고른 뒤 결과 줄. */
  result: { text: string; ok: boolean; picked: string } | null;
  choose: (id: string) => void;
};
/** T-11-390 구간 중계가 장면에서 멈추고, 고른 결과로 남은 경기를 바꾸는 쪽(keyMoments.ts, 구간 진행 때 불러온다). */
export interface MomentDriver {
  /**
   * game번째 경기 · extra번째 부가 줄(대회 결과)을 보여 주기 전에 장면이 걸려 있으면 v.moment에 카드를 띄우고, 고르거나 제한 시간이
   * 지나면 구간을 다시 진행한 결과(이미 보여 준 줄은 그대로)를 돌려준다. 장면이 없으면 null.
   */
  pause(
    v: { moment?: MomentView | null; skip: (() => void) | null },
    at: { game: number } | { extra: number },
  ): Promise<{ b: BlockResult; rows: TickerRow[]; extras: string[] } | null>;
}

export type SheetView =
  | {
      kind: 'steps';
      title: string;
      steps: string[];
      active: number;
      progress: number;
      /** 진행률 막대가 다음 값까지 차오르는 시간(ms) — 한 단계 길이와 같게 둬 끊김 없이 찬다(T-10-123). */
      fill: number;
    }
  | {
      /** T-10-028: 구간 경기를 한 경기씩 흘려보내는 중계 시트(T-10-024 전의 연출). 끝나면 리포트로 넘어간다. */
      kind: 'block';
      eyebrow: string;
      title: string;
      back: boolean;
      progress: number;
      /** 진행률 막대가 다음 값까지 차오르는 시간(ms) — 한 경기 간격과 같다. 건너뛰면 짧게. */
      fill: number;
      round: string;
      wdl: { w: number; d: number; l: number };
      tally: { apps: number; g: number; a: number; cs: number; rating: string };
      ticker: TickerRow[];
      extras: { text: string; done: boolean }[];
      skip: (() => void) | null;
      /** T-11-379 평점 구성을 보일 구간 경기(ratingReport ratingBreakdown). 경기가 다 나온 뒤에 채운다. */
      rated?: MatchGame[] | null;
      /** T-11-390 지금 멈춰 고르는 결정적 장면 카드. */
      moment?: MomentView | null;
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
      /** T-11-432 chips: 선택하면 늘 일어나는 득실(최대 2개, 안전한 선택은 가끔 대가까지 3개). */
      choices: { label: string; odds: string; chips: PeekChip[] }[];
      /** T-11-438 선택지 표기('안전' · '원터치') 뜻. 그런 선택지가 있을 때만 선택지 아래 한 줄씩 보인다. */
      legend: { term: string; text: string }[];
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
      trophyHonors?: { name: string; art: import('./career-trophy').CareerTrophy }[];
      comps: string[];
      /** T-11-261 대륙 대회 녹아웃 경로(대회 키·이름·한 줄). 녹아웃을 치른 대회만. */
      compPaths?: { key: string; name: string; line: string }[];
      tours: TourView[];
      gala: string[];
      miles: string[];
      titles: TitleView[];
      /** T-10-110 K리그2 우승 승격. */
      promo: Promotion | undefined;
      notes: string[];
      /** 옛 시트 호환용. 은퇴 전에는 화면에 표시하지 않는다. 육성 중 안내는 scoutHint가 맡는다. */
      scout?: string | null;
      /** 스카우트 한마디(scoutHint). 잠재력 등급 대신 수준만 문장으로 알려 준다. */
      scoutHint?: string | null;
      /** T-11-353 지난 시즌과 견준 흐름(평점·출전)과 나이 한 줄. 견줄 시즌이 없으면 null. */
      seasonTrend?: string | null;
      /** T-11-379 성장 방향 원자료(골 · 도움 · 수비 능력치, 문장은 ratingReport growthDirectionText). */
      growthDir?: GrowthDirInfo | null;
      fans: string[];
      age: number;
    }
  | {
      kind: 'market';
      eyebrow: string;
      note: string;
      assessment?: string | undefined;
      options: {
        clubId?: string;
        reason?: string | undefined;
        destination?: string | undefined;
        name: string;
        lg: string;
        salary: string | null;
        sub: string | null;
      }[];
    }
  | {
      /** T-11-034 업적 달성 알림(achNudge.ts achieveView). from이 있으면 등급이 올랐다. */
      kind: 'achieve';
      eyebrow: string;
      title: string;
      grade: { id: string; name: string };
      from: { id: string; name: string } | null;
      items: { label: string; gained: number }[];
      more: number;
      gained: number;
      score: number;
      next: string | null;
      /** T-11-357 받은 업적 보상 한 줄(없으면 null). */
      reward?: string | null;
    }
  | {
      /** 이적·조기 연장 계약서. 사인하면 onSign, ×는 onClose(저장된 이적시장으로 돌아간다). */
      kind: 'contract';
      eyebrow: string;
      title: string;
      text: string;
      club: { id: string; name: string };
      terms: { label: string; value: string }[];
      /** '이름 사인 사용'으로 그릴 선수 이름. */
      name: string;
      cta: string;
      onSign: () => void;
      onClose: () => void;
    }
  | {
      /** T-11-039 해외 이적 비행(로딩 장면). 본문이 FLIGHT_MS 동안 비행기를 경로 따라 옮긴다. done이면(건너뛰기) 바로 도착 장면. */
      kind: 'flight';
      eyebrow: string;
      title: string;
      sub: string;
      from: { code: string; city: string };
      to: { code: string; city: string };
      map: FlightMap;
      done: boolean;
      skip: () => void;
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
