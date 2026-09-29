/**
 * T-10-092 구단주 팀(팀 슬롯). zod가 없는 서브패스(`@offside/contracts/owner-team`)라 웹이 값으로 가져와도
 * 번들에 zod가 들어가지 않는다 — 서버의 팀 OVR·경기 시뮬레이션과 웹의 편성 미리보기가 같은 규칙을 쓴다.
 *
 * 팀은 구글 로그인한 구단주만 만든다. 선수는 그 구단주의 은퇴한 커리어만 넣고, 빈 자리는 유스 선수(고정 OVR)가
 * 채운다 — 은퇴 선수가 11명이 안 되는 구단주도 한 명만 넣으면 경기할 수 있다.
 */

import { DETAIL_GROUP, type DetailPos, type PeakProfile, type PosGroup } from './positions.js';

/** 구단주 한 명이 가질 수 있는 팀 수. 나중에 늘릴 때 이 값만 바꾼다. */
export const TEAM_SLOTS = 1;
/** 팀 이름 길이(앞뒤 공백 제외). */
export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 12;
/** 빈 자리를 채우는 유스 선수의 OVR. */
export const YOUTH_OVR = 50;
export const YOUTH_NAME = '유스 선수';
/** 구단주 한 명이 한국 시각 하루(자정 기준)에 치를 수 있는 경기 수. */
export const TEAM_MATCHES_PER_DAY = 10;
/** 한 팀의 선발 인원. */
export const LINEUP_SIZE = 11;

// 세부 포지션(T-10-091)은 커리어의 dpos와 같은 정의를 쓴다.
export {
  DETAIL_GROUP,
  DETAIL_LABEL,
  type DetailPos,
  type PeakProfile,
  type PosGroup,
} from './positions.js';

export const FORMATION_IDS = ['4-3-3', '4-4-2', '3-5-2'] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

/** 포메이션의 11자리. 순서는 골키퍼 → 수비 → 미드필더 → 공격, 줄 안에서는 왼쪽부터다. */
export const FORMATIONS: Record<FormationId, readonly DetailPos[]> = {
  '4-3-3': ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST', 'W'],
  '4-4-2': ['GK', 'FB', 'CB', 'CB', 'FB', 'W', 'CM', 'CM', 'W', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'FB', 'DM', 'AM', 'CM', 'FB', 'ST', 'ST'],
};

/** 그라운드에 그릴 줄마다의 인원(골키퍼 줄부터). 합은 11. */
export const FORMATION_ROWS: Record<FormationId, readonly number[]> = {
  '4-3-3': [1, 4, 3, 3],
  '4-4-2': [1, 4, 4, 2],
  '3-5-2': [1, 3, 5, 2],
};

/**
 * 최고 시점 능력치(PeakProfile)가 없는 선수(이 기능 전에 은퇴한 선수)가 그 자리에서 내는 비율. 세부 포지션이
 * 같으면 1.0, 세부 포지션을 모르고(null) 같은 계열이면 0.95, 같은 계열의 다른 세부 포지션이면 0.9, 필드
 * 플레이어끼리 다른 계열이면 0.75, 골키퍼 ↔ 필드는 0.3.
 */
export function fit(slot: DetailPos, pos: PosGroup, dpos?: DetailPos | null): number {
  const group = DETAIL_GROUP[slot];
  if (group === pos) {
    if (dpos == null) return 0.95;
    return dpos === slot ? 1 : 0.9;
  }
  return group === 'GK' || pos === 'GK' ? 0.3 : 0.75;
}

/** 자리 실력을 정하는 선수 정보. roles가 있으면(최고 시점 능력치) 그 자리 역할의 실력을 그대로 쓴다. */
export type SlotPlayer = {
  peak: number;
  pos: PosGroup;
  dpos?: DetailPos | null;
  roles?: PeakProfile['roles'] | null;
};

/**
 * 그 자리에서의 실력. 최고 시점 능력치가 있으면 그 자리 역할의 실력(최고 OVR을 넘지 않는다) — 발 빠른 센터백은
 * 풀백 자리에서도 잘 뛰고, 슈팅형 스트라이커는 윙어 자리에서 떨어진다. 없으면 최고 OVR × 적합도(반올림).
 */
export const slotRating = (slot: DetailPos, p: SlotPlayer): number =>
  p.roles ? Math.min(p.roles[slot], p.peak) : Math.round(p.peak * fit(slot, p.pos, p.dpos));

/** 팀의 세 줄. */
export const LINES = ['atk', 'mid', 'def'] as const;
export type Line = (typeof LINES)[number];
export type LineStrength = Record<Line, number> & { gk: number };

/**
 * 자리마다 공격·중원·수비에 보태는 몫(합 1, 골키퍼는 골문만). 풀백은 수비 중심에 측면 공격 가담, 수비형
 * 미드필더는 중원과 수비 반반, 윙어는 공격 중심에 중원 가담.
 */
export const SLOT_LINES: Record<Exclude<DetailPos, 'GK'>, Record<Line, number>> = {
  ST: { atk: 0.9, mid: 0.1, def: 0 },
  W: { atk: 0.65, mid: 0.3, def: 0.05 },
  AM: { atk: 0.4, mid: 0.55, def: 0.05 },
  CM: { atk: 0.15, mid: 0.65, def: 0.2 },
  DM: { atk: 0.05, mid: 0.5, def: 0.45 },
  FB: { atk: 0.2, mid: 0.3, def: 0.5 },
  CB: { atk: 0, mid: 0.05, def: 0.95 },
};
/**
 * 줄마다 기준 인원(필드 10명의 몫 합과 같은 10). 한 줄에 몫이 기준보다 많으면 그 줄이 LINE_PRESENCE_K점씩 세지고,
 * 합이 늘 10이라 다른 줄은 그만큼 약해진다 — 포메이션을 바꾸면 공격·중원·수비 무게가 옮겨 간다.
 */
export const LINE_BASE: Record<Line, number> = { atk: 3.25, mid: 2.85, def: 3.9 };
export const LINE_PRESENCE_K = 4;

/** 11자리 실력 → 공격·중원·수비(몫 가중 평균 + 인원 보정)와 골키퍼. 빈 자리는 유스 선수로 센다. */
export function lineStrength(
  formation: readonly DetailPos[],
  ratings: readonly (number | null)[],
): LineStrength {
  const sum: Record<Line, number> = { atk: 0, mid: 0, def: 0 };
  const w: Record<Line, number> = { atk: 0, mid: 0, def: 0 };
  let gk = YOUTH_OVR;
  formation.forEach((slot, i) => {
    const r = ratings[i] ?? YOUTH_OVR;
    if (slot === 'GK') {
      gk = r;
      return;
    }
    for (const l of LINES) {
      const share = SLOT_LINES[slot][l];
      sum[l] += share * r;
      w[l] += share;
    }
  });
  const line = (l: Line) =>
    (w[l] ? sum[l] / w[l] : YOUTH_OVR) + LINE_PRESENCE_K * (w[l] - LINE_BASE[l]);
  return { atk: line('atk'), mid: line('mid'), def: line('def'), gk };
}

/** 팀 OVR = 11자리 실력의 평균(반올림). 빈 자리는 유스 선수(YOUTH_OVR)로 센다. */
export function teamOvr(ratings: readonly (number | null)[]): number {
  let sum = 0;
  for (let i = 0; i < LINEUP_SIZE; i++) sum += ratings[i] ?? YOUTH_OVR;
  return Math.round(sum / LINEUP_SIZE);
}
