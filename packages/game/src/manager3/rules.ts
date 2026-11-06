// ───────── T-11-648 감독 커리어 3 규칙 값 ─────────
// 기획: docs/tracking/manager-career-plan-v3.md. 값은 밸런스 시뮬레이터(tooling/fulltime-sim/manager3.ts)로 맞춘다.
import type { FormationId } from '@offside/contracts/owner-team';
import {
  MANAGER3_ATTRS,
  MANAGER3_LICENSES,
  MANAGER3_SEASONS_MAX,
  type Manager3Attr,
  type Manager3License,
  type ManagerStyle,
} from '@offside/contracts/manager-rules';

export const M3_SAVE_KEY = 'ft_mgr3_save';
export const M3_SAVE_VERSION = 1;

/** 은퇴할 수 있는 최소 시즌 · 강제 은퇴 시즌 · 나이. */
export const M3_MIN_SEASONS = 5;
export const M3_MAX_SEASONS = MANAGER3_SEASONS_MAX;
export const M3_MAX_AGE = 65;
/** 한 시즌의 구간 수와 겨울 이적시장이 열리는 구간(이 구간을 마친 뒤). */
export const M3_BLOCKS = 6;
export const M3_WINTER_AFTER = 3;

/** 감독 능력치. */
export const M3_ATTRS = MANAGER3_ATTRS;
export type M3Attr = Manager3Attr;
export type M3Attrs = Record<M3Attr, number>;

/** 지도자 자격과 능력치 상한 · 맡을 수 있는 가장 높은 리그 등급. */
export const M3_LICENSES = MANAGER3_LICENSES;
export type M3License = Manager3License;
export const M3_LICENSE_CAP: Record<M3License, number> = { C: 60, B: 70, A: 82, P: 100 };
export const M3_LICENSE_TIER: Record<M3License, number> = { C: 4, B: 4, A: 6, P: 99 };
/** 다음 자격으로 오르는 조건(끝낸 시즌 수 · 명성). */
export const M3_LICENSE_NEXT: Record<M3License, { seasons: number; rep: number } | null> = {
  C: { seasons: 2, rep: 0 },
  B: { seasons: 4, rep: 45 },
  A: { seasons: 7, rep: 65 },
  P: null,
};

/** 선수 역할과 그 역할이 속한 포지션 무리. */
export const M3_ROLES = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'WG', 'ST'] as const;
export type M3Role = (typeof M3_ROLES)[number];
export type M3Group = 'GK' | 'DF' | 'MF' | 'FW';
export const M3_ROLE_GROUP: Record<M3Role, M3Group> = {
  GK: 'GK',
  CB: 'DF',
  FB: 'DF',
  DM: 'MF',
  CM: 'MF',
  AM: 'MF',
  WG: 'FW',
  ST: 'FW',
};

export type M3Lines = { atk: number; mid: number; def: number; gk: number };
/** 역할이 줄 힘에 나눠 주는 몫. */
export const M3_ROLE_LINES: Record<M3Role, Partial<M3Lines>> = {
  GK: { gk: 1 },
  CB: { def: 1 },
  FB: { def: 0.7, mid: 0.1, atk: 0.2 },
  DM: { def: 0.45, mid: 0.55 },
  CM: { mid: 0.8, atk: 0.1, def: 0.1 },
  AM: { mid: 0.45, atk: 0.55 },
  WG: { atk: 0.75, mid: 0.25 },
  ST: { atk: 1 },
};

/** 감독 커리어 3의 포메이션. 뒤 둘은 감독 카드 숙련에서 바탕 포메이션으로 센다. */
export const M3_FORMATIONS = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '5-3-2'] as const;
export type M3Formation = (typeof M3_FORMATIONS)[number];
export const M3_FORMATION_BASE: Record<M3Formation, FormationId> = {
  '4-3-3': '4-3-3',
  '4-4-2': '4-4-2',
  '3-5-2': '3-5-2',
  '4-2-3-1': '4-3-3',
  '5-3-2': '3-5-2',
};
export const M3_FORMATION_ROLES: Record<M3Formation, readonly M3Role[]> = {
  '4-3-3': ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'CM', 'WG', 'ST', 'WG'],
  '4-4-2': ['GK', 'FB', 'CB', 'CB', 'FB', 'WG', 'CM', 'CM', 'WG', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'FB', 'DM', 'CM', 'CM', 'FB', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'DM', 'WG', 'AM', 'WG', 'ST'],
  '5-3-2': ['GK', 'FB', 'CB', 'CB', 'CB', 'FB', 'CM', 'DM', 'CM', 'ST', 'ST'],
};

/** 성향(감독 커리어 2 · 감독 카드와 같은 넷)이 줄 힘에 더하는 값. */
export const M3_MENTALITY: Record<ManagerStyle, Partial<M3Lines>> = {
  attack: { atk: 1.5, def: -1 },
  balance: { mid: 0.5 },
  defense: { def: 1.5, atk: -1 },
  counter: { atk: 0.5, def: 0.7, mid: -0.6 },
};

/** 지시 3단계(0 낮게 · 1 보통 · 2 높게). */
export type M3Level = 0 | 1 | 2;
export type M3Plan = {
  formation: M3Formation;
  mentality: ManagerStyle;
  press: M3Level;
  line: M3Level;
  tempo: M3Level;
  talk: M3Talk;
  /** 직접 고른 선발 11명(선수 id, 역할 순서). null이면 자동 추천. */
  lineup: number[] | null;
};
export const M3_TALKS = ['praise', 'calm', 'demand'] as const;
export type M3Talk = (typeof M3_TALKS)[number];

/** 선수 성격. */
export const M3_TRAITS = ['pro', 'leader', 'temper', 'lazy', 'loyal'] as const;
export type M3Trait = (typeof M3_TRAITS)[number];

/** 선수단 크기. */
export const M3_SQUAD_MIN = 18;
export const M3_SQUAD_MAX = 30;
/** 이적시장 영입 후보 수. */
export const M3_TARGETS = 8;

/** 득점 계산: 같은 전력의 한 팀 기대 득점과 전력 차가 득점에 주는 세기(클수록 약하다). */
export const M3_GOAL_BASE = 1.32;
export const M3_GOAL_K = 20;
export const M3_HOME_EDGE = 0.12;
