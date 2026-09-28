/**
 * T-10-092 구단주 팀(팀 슬롯). zod가 없는 서브패스(`@offside/contracts/owner-team`)라 웹이 값으로 가져와도
 * 번들에 zod가 들어가지 않는다 — 서버의 팀 OVR·경기 시뮬레이션과 웹의 편성 미리보기가 같은 규칙을 쓴다.
 *
 * 팀은 구글 로그인한 구단주만 만든다. 선수는 그 구단주의 은퇴한 커리어만 넣고, 빈 자리는 유스 선수(고정 OVR)가
 * 채운다 — 은퇴 선수가 11명이 안 되는 구단주도 한 명만 넣으면 경기할 수 있다.
 */

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

export type PosGroup = 'FW' | 'MF' | 'DF' | 'GK';

/** 세부 포지션(원작의 8개). 커리어의 dpos(T-10-091)와 같은 코드를 쓴다. */
export const DETAIL_POS = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'] as const;
export type DetailPos = (typeof DETAIL_POS)[number];

export const DETAIL_GROUP: Record<DetailPos, PosGroup> = {
  GK: 'GK',
  CB: 'DF',
  FB: 'DF',
  DM: 'MF',
  CM: 'MF',
  AM: 'MF',
  W: 'FW',
  ST: 'FW',
};

export const DETAIL_LABEL: Record<DetailPos, string> = {
  GK: '골키퍼',
  CB: '센터백',
  FB: '풀백',
  DM: '수비형 미드필더',
  CM: '중앙 미드필더',
  AM: '공격형 미드필더',
  W: '윙어',
  ST: '스트라이커',
};

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
 * 선수가 그 자리에서 내는 비율. 세부 포지션이 같으면 1.0, 세부 포지션을 모르고(null) 같은 계열이면 0.95, 같은
 * 계열의 다른 세부 포지션이면 0.9, 필드 플레이어끼리 다른 계열이면 0.75, 골키퍼 ↔ 필드는 0.3.
 */
export function fit(slot: DetailPos, pos: PosGroup, dpos?: DetailPos | null): number {
  const group = DETAIL_GROUP[slot];
  if (group === pos) {
    if (dpos == null) return 0.95;
    return dpos === slot ? 1 : 0.9;
  }
  return group === 'GK' || pos === 'GK' ? 0.3 : 0.75;
}

/** 그 자리에서의 실력 = 최고 OVR × 적합도(반올림). */
export const slotRating = (
  peak: number,
  slot: DetailPos,
  pos: PosGroup,
  dpos?: DetailPos | null,
): number => Math.round(peak * fit(slot, pos, dpos));

/** 팀 OVR = 11자리 실력의 평균(반올림). 빈 자리는 유스 선수(YOUTH_OVR)로 센다. */
export function teamOvr(ratings: readonly (number | null)[]): number {
  let sum = 0;
  for (let i = 0; i < LINEUP_SIZE; i++) sum += ratings[i] ?? YOUTH_OVR;
  return Math.round(sum / LINEUP_SIZE);
}
