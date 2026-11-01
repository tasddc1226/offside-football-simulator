/**
 * T-11-600 라운지 필드 동기화 — 채팅방 소켓 위로 오가는 필드 이벤트. 위치 · 동작 · 공은 저장하지 않고 필드를 연
 * 소켓에만 바로 넘기며, 골만 방이 하루(KST) 단위로 센다. zod 없는 서브패스(`@offside/contracts/lounge-field`)라
 * 웹 · 앱과 Durable Object가 같은 값을 쓴다.
 */

/** 경기장 크기(미터). 서버는 이 범위를 조금 넘는 값만 받는다. */
export const FIELD_PITCH_L = 36;
export const FIELD_PITCH_W = 24;
/** 받는 좌표 범위(걸어 다니는 여백 · 골망 포함). */
export const FIELD_COORD_MIN = -6;
export const FIELD_COORD_MAX = 42;

/** 클라이언트가 위치를 보내는 최소 간격(움직일 때만 보낸다). */
export const FIELD_POS_MS = 120;
/** 공을 몰고 갈 때 공 상태를 보내는 최소 간격. 찰 때는 바로 보낸다. */
export const FIELD_BALL_MS = 150;
/** 서버가 같은 소켓의 위치 · 공을 받는 최소 간격(이보다 잦으면 버린다). */
export const FIELD_SERVER_MIN_MS = 60;
/** 골을 인정하려면 그 소켓이 이 시간 안에 공을 건드렸어야 한다. */
export const FIELD_GOAL_TOUCH_MS = 6_000;
/** 골 사이 최소 간격(축하 · 공 되돌리기 시간). */
export const FIELD_GOAL_GAP_MS = 2_500;
/** 오늘의 득점 표에 싣는 줄 수. */
export const FIELD_SCORE_ROWS = 5;
/** 지난 날짜 득점 줄을 지우기 전에 남겨 두는 날 수. */
export const FIELD_SCORE_KEEP_DAYS = 3;

export const FIELD_ACTS = ['kick', 'tackle', 'flick', 'spin', 'stepover', 'emote'] as const;
export type FieldAct = (typeof FIELD_ACTS)[number];
export const FIELD_EMOTES = ['wave', 'thumbs', 'laugh', 'fire', 'ball', 'heart'] as const;
export type FieldEmote = (typeof FIELD_EMOTES)[number];

/** 필드에 있는 다른 사람(마지막으로 받은 위치). */
export type FieldPeer = { a: string; n: string; x: number; y: number; fx: number; fy: number };
/** 오늘의 득점 한 줄. */
export type FieldGoalRow = { a: string; n: string; goals: number };
export type FieldBall = { x: number; y: number; z: number; vx: number; vy: number; vz: number };

/** 클라이언트 → 서버. */
export type FieldClientEvent =
  /** 필드 보기를 열고 닫는다. 연 소켓만 필드 이벤트를 받는다. */
  | { t: 'field'; on: boolean }
  | { t: 'pos'; x: number; y: number; fx: number; fy: number }
  /** s: 도는 · 빠지는 쪽(±1), e: 이모트. */
  | { t: 'act'; k: FieldAct; s?: 1 | -1; e?: FieldEmote }
  | ({ t: 'ball' } & FieldBall)
  /** 내가 마지막으로 건드린 공이 골이 됐다. side: 들어간 골대(0: x=0 쪽, 1: 반대쪽). */
  | { t: 'goal'; side: 0 | 1 };

/** 서버 → 클라이언트(필드를 연 소켓에만). a는 작성자 키(채팅 author), n은 닉네임. */
export type FieldServerEvent =
  /** 필드를 열면 받는 지금 상태. ball: 마지막으로 받은 공 상태(없으면 가운데). */
  | {
      t: 'field';
      peers: FieldPeer[];
      score: FieldGoalRow[];
      day: string;
      ball?: { a: string } & FieldBall;
    }
  | ({ t: 'pos' } & FieldPeer)
  | { t: 'act'; a: string; k: FieldAct; s?: 1 | -1; e?: FieldEmote }
  | ({ t: 'ball'; a: string } & FieldBall)
  | { t: 'goal'; a: string; n: string; side: 0 | 1; score: FieldGoalRow[]; day: string }
  /** 필드를 닫았거나 나갔다. */
  | { t: 'leave'; a: string };

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;

/** 받은 필드 이벤트를 검사해 고친 값을 돌려준다. 모르는 모양이면 null. */
export function parseFieldEvent(e: Record<string, unknown>): FieldClientEvent | null {
  switch (e.t) {
    case 'field':
      return typeof e.on === 'boolean' ? { t: 'field', on: e.on } : null;
    case 'pos': {
      const x = num(e.x, FIELD_COORD_MIN, FIELD_COORD_MAX);
      const y = num(e.y, FIELD_COORD_MIN, FIELD_COORD_MAX);
      const fx = num(e.fx, -1, 1);
      const fy = num(e.fy, -1, 1);
      return x === null || y === null || fx === null || fy === null
        ? null
        : { t: 'pos', x, y, fx, fy };
    }
    case 'act': {
      if (!(FIELD_ACTS as readonly unknown[]).includes(e.k)) return null;
      const k = e.k as FieldAct;
      if (k === 'emote')
        return (FIELD_EMOTES as readonly unknown[]).includes(e.e)
          ? { t: 'act', k, e: e.e as FieldEmote }
          : null;
      return { t: 'act', k, ...(e.s === 1 || e.s === -1 ? { s: e.s } : {}) };
    }
    case 'ball': {
      const x = num(e.x, FIELD_COORD_MIN, FIELD_COORD_MAX);
      const y = num(e.y, FIELD_COORD_MIN, FIELD_COORD_MAX);
      const z = num(e.z, 0, 20);
      const vx = num(e.vx, -40, 40);
      const vy = num(e.vy, -40, 40);
      const vz = num(e.vz, -40, 40);
      if (x === null || y === null || z === null || vx === null || vy === null || vz === null)
        return null;
      return { t: 'ball', x, y, z, vx, vy, vz };
    }
    case 'goal':
      return e.side === 0 || e.side === 1 ? { t: 'goal', side: e.side } : null;
    default:
      return null;
  }
}

/** 한국 시각 날짜(YYYY-MM-DD). 오늘의 득점이 이 날짜로 나뉜다. */
export const fieldDay = (now: number) => new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
